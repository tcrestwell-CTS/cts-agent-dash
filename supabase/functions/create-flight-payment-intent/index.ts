import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { logPaymentAttempt } from "../_shared/payment-ip-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate agent
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_CLIENT");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { amount_cents, currency, booking_id, trip_id, description } = await req.json();

    logPaymentAttempt(req, {
      page: 'create-flight-payment-intent',
      outcome: 'attempted',
      amount_cents,
      currency,
      booking_id: booking_id || null,
      trip_id: trip_id || null,
    });

    if (!amount_cents || amount_cents < 50) {
      logPaymentAttempt(req, {
        page: 'create-flight-payment-intent',
        outcome: 'blocked',
        amount_cents,
        booking_id: booking_id || null,
        trip_id: trip_id || null,
        metadata: { reason: 'amount_below_minimum' },
      });
      return new Response(JSON.stringify({ error: "Amount must be at least 50 cents" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount_cents),
      currency: (currency || "usd").toLowerCase(),
      metadata: {
        booking_id: booking_id || "",
        trip_id: trip_id || "",
        agent_user_id: user.id,
        type: "flight_payment",
      },
      description: description || "Flight booking payment",
      // Bank/ACH explicitly excluded -- same reasoning as create-payment-intent:
      // multi-day settlement isn't appropriate for real-time flight booking
      // payments. Everything else dynamic (card, Klarna, Amazon Pay) stays.
      automatic_payment_methods: { enabled: true, allow_redirects: "always" },
      excluded_payment_method_types: ["us_bank_account"],
    });

    logPaymentAttempt(req, {
      page: 'create-flight-payment-intent',
      outcome: 'succeeded',
      amount_cents,
      currency,
      booking_id: booking_id || null,
      trip_id: trip_id || null,
      stripe_payment_intent_id: paymentIntent.id,
    });

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create flight payment intent error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    logPaymentAttempt(req, {
      page: 'create-flight-payment-intent',
      outcome: 'failed',
      metadata: { error: msg },
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
