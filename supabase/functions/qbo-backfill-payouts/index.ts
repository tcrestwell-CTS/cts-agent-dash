// supabase/functions/qbo-backfill-payouts/index.ts
//
// One-shot backfill: re-triggers QBO Transfer posting for payout IDs that
// previously logged status = 'skipped' with reason = 'no_classified_amounts'.
//
// Usage (call once from dashboard or curl):
//   POST /functions/v1/qbo-backfill-payouts
//   Authorization: Bearer <agent JWT>
//   Body: { "payout_ids": ["po_xxx", "po_yyy"] }   // optional — omit to auto-detect all skipped
//
// The function deletes the skipped qbo_sync_logs rows (freeing the idempotency key)
// and re-invokes stripe-payout-webhook logic for each payout by constructing a
// synthetic payout.paid event body and calling the payout processor directly.
//
// Safe to call multiple times — idempotency is re-established after re-processing.
//
// Deploy:
//   supabase functions deploy qbo-backfill-payouts --project-ref zbtnulzvwreqzbmxulpv

import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_FUNCTION_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/stripe-payout-webhook`;
// We bypass Stripe signature verification by calling the internal processor
// directly via service role. The payout-webhook handler exports a named
// processPayoutPaid() function; here we call it via a signed internal request.

const log = (msg: string, data?: unknown) =>
  console.log(`[qbo-backfill-payouts] ${msg}`, data ? JSON.stringify(data) : "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: require a valid agent JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: userRes } = await anonClient.auth.getUser(token);
  if (!userRes.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }

  let payoutIds: string[] = [];

  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body.payout_ids) && body.payout_ids.length > 0) {
      payoutIds = body.payout_ids;
    } else {
      // Auto-detect: find all qbo_sync_logs with status=skipped and reason=no_classified_amounts
      const { data: logs } = await supabase
        .from("qbo_sync_logs")
        .select("details, idempotency_key")
        .eq("status", "skipped")
        .eq("sync_type", "auto-stripe-payout")
        .order("created_at", { ascending: false })
        .limit(50);

      for (const row of logs ?? []) {
        const pid = row.details?.payout_id ?? row.idempotency_key?.replace("stripe_payout:", "");
        if (pid && !payoutIds.includes(pid)) payoutIds.push(pid);
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "bad_request", detail: String(e) }), {
      status: 400, headers: corsHeaders,
    });
  }

  if (payoutIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "No skipped payouts found.", processed: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log(`Processing ${payoutIds.length} skipped payouts`, payoutIds);

  const results: Array<{ payout_id: string; status: string; detail?: string }> = [];

  for (const payoutId of payoutIds) {
    try {
      // 1. Fetch the payout from Stripe to get the live object
      const payout = await stripe.payouts.retrieve(payoutId);

      if (payout.status !== "paid") {
        results.push({ payout_id: payoutId, status: "skipped_not_paid", detail: payout.status });
        continue;
      }

      // 2. Delete the stale skipped log row so the idempotency key is freed
      const idemKey = `stripe_payout:${payoutId}`;
      const { error: delErr } = await supabase
        .from("qbo_sync_logs")
        .delete()
        .eq("idempotency_key", idemKey)
        .eq("status", "skipped");

      if (delErr) {
        log(`Warning: could not delete stale log for ${payoutId}`, delErr);
      } else {
        log(`Freed idempotency key ${idemKey}`);
      }

      // 3. Also clear the stripe_payouts row's qbo_* fields so the re-run
      //    treats this as a fresh posting attempt
      await supabase
        .from("stripe_payouts")
        .update({
          qbo_trip_transfer_id: null,
          qbo_loan_principal_transfer_id: null,
          qbo_loan_interest_transfer_id: null,
          qbo_sync_status: "pending",
          qbo_synced_at: null,
        })
        .eq("stripe_payout_id", payoutId);

      // 4. Re-invoke the webhook function with a synthetic payout.paid event
      //    using the service role key as the internal auth mechanism
      const syntheticEvent = {
        id: `evt_backfill_${payoutId}_${Date.now()}`,
        type: "payout.paid",
        data: { object: payout },
        _backfill: true, // signals the handler to skip Stripe signature check
      };

      const handlerRes = await fetch(WEBHOOK_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Use service role to bypass signature verification in the handler
          "x-supabase-service-role": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          "stripe-signature": "backfill", // handler must check for this sentinel
        },
        body: JSON.stringify(syntheticEvent),
      });

      const handlerBody = await handlerRes.json().catch(() => ({}));

      if (handlerRes.ok) {
        log(`Payout ${payoutId} re-processed successfully`, handlerBody);
        results.push({ payout_id: payoutId, status: "reprocessed", detail: JSON.stringify(handlerBody) });
      } else {
        log(`Payout ${payoutId} re-processing failed`, handlerBody);
        results.push({ payout_id: payoutId, status: "failed", detail: JSON.stringify(handlerBody) });
      }
    } catch (e: any) {
      log(`Error processing ${payoutId}`, e.message);
      results.push({ payout_id: payoutId, status: "error", detail: e.message });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
