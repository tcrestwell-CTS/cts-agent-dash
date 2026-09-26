import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isInternalCaller } from "../_shared/internal-auth.ts";

/**
 * create-standalone-payment
 *
 * Creates a standalone (not agent-linked) payment record for the public
 * crestwellgetaways.com /pay flow — e.g. generic group-trip deposits that
 * have no existing trip_payments row.
 *
 * Because trip_payments.trip_id and .user_id are NOT NULL, this creates a
 * lightweight "shell" trip owned by the agency admin account, flagged with
 * source = 'standalone_payment' and a "[Online Payment]" name prefix so it
 * is visually distinct in the dashboard from real agent-managed trips.
 *
 * Auth: internal callers only (service-role key or x-agent-secret), same
 * pattern as create-virtual-card. Called from the public site's server-side
 * proxy — never directly from a browser.
 *
 * Request body (JSON):
 *   customer_name  string  (required)
 *   customer_email string  (required)
 *   customer_phone string  (optional)
 *   amount         number  (required) — DOLLARS, e.g. 1527.33
 *   trip_name      string  (required) — e.g. "Claire's 60th Birthday Celebration"
 *   booking_ref    string  (optional) — e.g. "CTS-DEP-1790385957943"
 *   payment_type   string  (optional, default "deposit")
 *
 * Response 200:
 *   { success: true, paymentId, tripId, amount, status: "pending" }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-secret",
};

// Agency admin account that owns standalone shell trips (Tim Crestwell).
const STANDALONE_OWNER_USER_ID = "5c2d70a4-a902-47fa-aaf0-f29fc2eb1562";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isInternalCaller(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      customer_name,
      customer_email,
      customer_phone,
      amount,
      trip_name,
      booking_ref,
      payment_type,
    } = body ?? {};

    if (!customer_name || typeof customer_name !== "string") {
      throw new Error("customer_name is required");
    }
    if (!customer_email || typeof customer_email !== "string") {
      throw new Error("customer_email is required");
    }
    if (!trip_name || typeof trip_name !== "string") {
      throw new Error("trip_name is required");
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new Error("amount must be a positive number (in dollars, e.g. 1527.33)");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Create the shell trip ──────────────────────────────────────
    const shellTripName = `[Online Payment] ${trip_name}`;
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .insert({
        user_id: STANDALONE_OWNER_USER_ID,
        trip_name: shellTripName,
        destination: "Online Payment",
        status: "planning",
        source: "standalone_payment",
        total_gross_sales: amountNum,
        balance_due: amountNum,
        total_scheduled: amountNum,
      })
      .select("id")
      .single();
    if (tripErr || !trip) throw new Error(`Failed to create shell trip: ${tripErr?.message}`);

    // ── 2. Create the pending payment row ─────────────────────────────
    const { data: payment, error: payErr } = await supabase
      .from("trip_payments")
      .insert({
        trip_id: trip.id,
        user_id: STANDALONE_OWNER_USER_ID,
        amount: amountNum,
        payment_type: payment_type || "deposit",
        status: "pending",
        payer_name: customer_name,
        payer_email: customer_email,
        payer_phone: customer_phone || null,
        booking_ref: booking_ref || null,
        notes: booking_ref ? `Booking ref: ${booking_ref}` : null,
      })
      .select("id, status, amount")
      .single();
    if (payErr || !payment) throw new Error(`Failed to create payment: ${payErr?.message}`);

    return new Response(JSON.stringify({
      success: true,
      paymentId: payment.id,
      tripId: trip.id,
      amount: payment.amount,
      status: payment.status,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("create-standalone-payment error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
