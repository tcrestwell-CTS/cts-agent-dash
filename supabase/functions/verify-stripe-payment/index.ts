import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-portal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId is required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    let receiptUrl: string | null = null;

    if (session.payment_status === "paid") {
      // Try to get receipt URL from the charge
      if (session.payment_intent) {
        try {
          const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
          if (pi.latest_charge) {
            const charge = await stripe.charges.retrieve(pi.latest_charge as string);
            receiptUrl = charge.receipt_url || null;
          }
        } catch (e) {
          console.error("Failed to fetch receipt URL:", e);
        }
      }

      const paymentId = session.metadata?.trip_payment_id;
      if (paymentId) {
        await supabase
          .from("trip_payments")
          .update({
            status: "paid",
            payment_method: "stripe",
            payment_date: new Date().toISOString().split("T")[0],
            details: `Stripe payment ${session.payment_intent}`,
            stripe_receipt_url: receiptUrl,
          })
          .eq("id", paymentId);
      }
    }

    return new Response(JSON.stringify({
      status: session.payment_status,
      paid: session.payment_status === "paid",
      receiptUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("verify-stripe-payment error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
