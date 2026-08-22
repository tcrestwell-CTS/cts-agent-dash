import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logPaymentAttempt } from "../_shared/payment-ip-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-portal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAccessiblePortalClientIds(supabase: any, seedClientId: string | null) {
  if (!seedClientId) return [];

  const { data: seedClient } = await supabase
    .from("clients")
    .select("id, email")
    .eq("id", seedClientId)
    .maybeSingle();

  if (!seedClient?.email) {
    return [seedClientId];
  }

  const { data: siblingClients } = await supabase
    .from("clients")
    .select("id")
    .eq("email", seedClient.email);

  const siblingIds = siblingClients?.map((client: { id: string }) => client.id) ?? [];
  return siblingIds.length > 0 ? [...new Set(siblingIds)] : [seedClientId];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { paymentId, returnUrl, portalToken, embedded, paymentMethodChoice } = body;
    if (!paymentId) throw new Error("paymentId is required");

    logPaymentAttempt(req, {
      page: 'create-stripe-payment',
      outcome: 'attempted',
      metadata: { paymentId, embedded: !!embedded },
    });

    let isPortal = false;
    let clientId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    const portalTokenHeader = req.headers.get("x-portal-token") || portalToken;

    if (portalTokenHeader) {
      const { data: session } = await supabase
        .from("client_portal_sessions")
        .select("client_id, expires_at, verified_at")
        .eq("token", portalTokenHeader)
        .gt("expires_at", new Date().toISOString())
        .not("verified_at", "is", null)
        .maybeSingle();

      if (!session) throw new Error("Invalid or expired portal session");
      clientId = session.client_id;
      isPortal = true;
    } else if (authHeader) {
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!
      );
      const token = authHeader.replace("Bearer ", "");
      const { data } = await anonClient.auth.getUser(token);
      if (!data.user) throw new Error("Not authenticated");

      // If the authenticated user is an agent (has any role in user_roles),
      // treat this as an agent-initiated payment and skip portal access checks.
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .limit(1);

      if (roles && roles.length > 0) {
        // Agent context — full access
        isPortal = false;
      } else {
        const { data: profile } = await supabase
          .from("client_profiles")
          .select("client_id")
          .eq("auth_user_id", data.user.id)
          .maybeSingle();

        if (profile) {
          clientId = profile.client_id;
          isPortal = true;
        }
      }
    } else {
      throw new Error("No authentication provided");
    }

    const { data: payment, error: paymentError } = await supabase
      .from("trip_payments")
      .select("id, amount, trip_id, status, details, payment_type, payer_name, payer_email")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) throw new Error("Payment not found");
    if (payment.status === "paid") throw new Error("Payment already completed");

    const { data: trip } = await supabase
      .from("trips")
      .select("trip_name, client_id, user_id")
      .eq("id", payment.trip_id)
      .single();

    if (isPortal && trip) {
      const accessibleClientIds = await getAccessiblePortalClientIds(supabase, clientId);
      if (!accessibleClientIds.includes(trip.client_id)) {
        throw new Error("Unauthorized: you don't have access to this payment");
      }
    }

    const actualClientId = trip?.client_id || clientId;
    // Split payments: the specific payer's email wins over the primary client's.
    let customerEmail: string | null = (payment as any).payer_email || null;
    if (!customerEmail && actualClientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("email, name")
        .eq("id", actualClientId)
        .single();
      customerEmail = client?.email || null;
    }


    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let customerId: string | undefined;
    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const paymentTypeLabel = payment.payment_type === "final_balance"
      ? "Final Balance"
      : payment.payment_type.charAt(0).toUpperCase() + payment.payment_type.slice(1);
    const description = `${paymentTypeLabel}${trip?.trip_name ? ` – ${trip.trip_name}` : ""}`;

    const baseAmount = payment.amount;
    const grossedUpAmount = (baseAmount + 0.30) / (1 - 0.029);
    const chargeAmountCents = Math.round(grossedUpAmount * 100);

    const appBaseUrl = returnUrl || req.headers.get("origin") || "https://cts-agent-dash.lovable.app";
    const tripIdParam = payment.trip_id ? `&trip_id=${payment.trip_id}` : "";

    // Routing metadata for stripe-webhook → CRM (architecture: CRM is system of record)
    const routingMetadata = {
      payment_type: "trip_installment",
      trip_payment_id: paymentId,
      trip_id: payment.trip_id,
    };

    let session: any;

    if (!isPortal && embedded) {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : customerEmail || undefined,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: description,
                description: payment.details || undefined,
              },
              unit_amount: Math.round(baseAmount * 100),
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Processing Fee",
                description: "Credit card processing fee",
              },
              unit_amount: chargeAmountCents - Math.round(baseAmount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded",
        return_url: `${appBaseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}${tripIdParam}`,
        metadata: routingMetadata,
        payment_intent_data: { metadata: routingMetadata },
      });
    } else {
      const successUrl = isPortal
        ? `${appBaseUrl}/client?payment=success&session_id={CHECKOUT_SESSION_ID}`
        : `${appBaseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}${tripIdParam}`;
      const cancelUrl = isPortal
        ? `${appBaseUrl}/client?payment=cancelled`
        : `${appBaseUrl}/payment-success?payment=cancelled${tripIdParam}`;

      session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : customerEmail || undefined,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: description,
                description: payment.details || undefined,
              },
              unit_amount: Math.round(baseAmount * 100),
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Processing Fee",
                description: "Credit card processing fee",
              },
              unit_amount: chargeAmountCents - Math.round(baseAmount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: routingMetadata,
        payment_intent_data: { metadata: routingMetadata },
      });
    }

    const updateData: any = {
      stripe_session_id: session.id,
      stripe_payment_url: session.url || null,
    };

    if (paymentMethodChoice) {
      updateData.payment_method_choice = paymentMethodChoice;
    }

    await supabase
      .from("trip_payments")
      .update(updateData)
      .eq("id", paymentId);

    logPaymentAttempt(req, {
      page: 'create-stripe-payment',
      outcome: 'succeeded',
      amount_cents: chargeAmountCents,
      currency: 'usd',
      customer_email: customerEmail,
      client_id: actualClientId || null,
      trip_id: payment.trip_id || null,
      metadata: { stripe_session_id: session.id, payment_id: paymentId },
    });

    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id,
      clientSecret: session.client_secret || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("create-stripe-payment error:", message);
    logPaymentAttempt(req, {
      page: 'create-stripe-payment',
      outcome: 'failed',
      metadata: { error: message },
    });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});