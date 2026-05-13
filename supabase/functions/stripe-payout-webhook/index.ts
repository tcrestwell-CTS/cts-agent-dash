// supabase/functions/stripe-payout-webhook/index.ts
//
// Dedicated Stripe webhook for `payout.paid` events.
// On each payout, we walk the balance transactions, classify each charge by
// its PaymentIntent.metadata.payment_type (`trip_installment` vs `loan_repayment`),
// split loan amounts into principal vs interest using the matching
// loan_payment_schedules row, and then post QBO Transfers from each clearing
// account (Trip Stripe Clearing, Loan Principal Clearing, Loan Interest Clearing)
// to the operating bank for the actual amount that landed in the bank.
//
// Idempotency:
//   - Webhook layer: stripe_webhook_events.stripe_event_id (unique)
//   - QBO push:      qbo_sync_logs.idempotency_key = `stripe_payout:{payout_id}`
//   - Per-bucket:    transfer IDs persisted on stripe_payouts so partial retries
//                    don't double-post.
//
// CRM remains the system of record. This function only updates `stripe_payouts`
// and writes Transfers in QBO — it does not write any other CRM tables.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Allow a dedicated payout webhook secret, but fall back to the shared one.
const WEBHOOK_SECRET =
  Deno.env.get("STRIPE_PAYOUT_WEBHOOK_SECRET") ||
  Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";

const log = (step: string, data?: unknown) =>
  console.log(`[stripe-payout-webhook] ${step}`, data ? JSON.stringify(data) : "");

// ─── Bucket math ────────────────────────────────────────────────────────────

type Buckets = {
  trip: number;
  loan_principal: number;
  loan_interest: number;
  unclassified: number;
  details: Array<Record<string, unknown>>;
};

function emptyBuckets(): Buckets {
  return { trip: 0, loan_principal: 0, loan_interest: 0, unclassified: 0, details: [] };
}

/**
 * Walk the Stripe balance transactions for a payout and split the net amount
 * (gross − Stripe fee) into the three CRM buckets.
 */
async function buildBuckets(payoutId: string): Promise<Buckets> {
  const buckets = emptyBuckets();
  let starting_after: string | undefined = undefined;

  while (true) {
    const page = await stripe.balanceTransactions.list({
      payout: payoutId,
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });

    for (const txn of page.data) {
      // Only money-in legs route to clearing buckets. Refunds/adjustments are
      // handled separately and intentionally skipped here.
      if (txn.type !== "charge") continue;

      const net = txn.net / 100; // dollars actually landing in the bank for this charge
      const piId = typeof txn.source === "string" ? txn.source : null;
      if (!piId || net <= 0) continue;

      // PI is actually a charge id on balance txn.source — resolve to PI for metadata.
      let pi: Stripe.PaymentIntent | null = null;
      try {
        const charge = await stripe.charges.retrieve(piId);
        const piRef = charge.payment_intent;
        if (piRef) {
          pi = typeof piRef === "string" ? await stripe.paymentIntents.retrieve(piRef) : piRef;
        }
      } catch (e) {
        log("could not resolve charge → PI", { source: piId, err: String(e) });
      }

      const meta = pi?.metadata ?? {};
      const paymentType = String(meta.payment_type || "").toLowerCase();

      if (paymentType === "trip_installment") {
        buckets.trip += net;
        buckets.details.push({
          source: piId, payment_intent: pi?.id, type: "trip_installment", net,
        });
        continue;
      }

      if (paymentType === "loan_repayment") {
        const split = await splitLoanNet(pi, net);
        buckets.loan_principal += split.principal;
        buckets.loan_interest += split.interest;
        buckets.details.push({
          source: piId,
          payment_intent: pi?.id,
          type: "loan_repayment",
          loan_id: meta.loan_id || null,
          installment_no: meta.installment_no || null,
          net,
          principal: split.principal,
          interest: split.interest,
        });
        continue;
      }

      buckets.unclassified += net;
      buckets.details.push({
        source: piId,
        payment_intent: pi?.id,
        type: "unclassified",
        payment_type_meta: paymentType || null,
        net,
      });
    }

    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1]?.id;
    if (!starting_after) break;
  }

  // Round to cents.
  buckets.trip = round2(buckets.trip);
  buckets.loan_principal = round2(buckets.loan_principal);
  buckets.loan_interest = round2(buckets.loan_interest);
  buckets.unclassified = round2(buckets.unclassified);
  return buckets;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * For a loan repayment, look up the matching loan_payment_schedules row and
 * pro-rate the *net* amount (after Stripe fees) by the original
 * principal/interest ratio. Falls back to "all principal" if the row can't
 * be resolved — better than over-recognizing income.
 */
async function splitLoanNet(
  pi: Stripe.PaymentIntent | null,
  net: number,
): Promise<{ principal: number; interest: number }> {
  if (!pi) return { principal: net, interest: 0 };

  const loanId = pi.metadata?.loan_id;
  const installmentNo = pi.metadata?.installment_no
    ? Number(pi.metadata.installment_no)
    : null;

  let row: { principal_amount: number | null; interest_amount: number | null } | null = null;

  // Prefer match by stripe_payment_intent_id (the most authoritative link).
  const { data: byPi } = await supabase
    .from("loan_payment_schedules")
    .select("principal_amount, interest_amount")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();
  row = byPi || null;

  if (!row && loanId && installmentNo != null) {
    const { data: byKey } = await supabase
      .from("loan_payment_schedules")
      .select("principal_amount, interest_amount")
      .eq("loan_application_id", loanId)
      .eq("payment_number", installmentNo)
      .maybeSingle();
    row = byKey || null;
  }

  if (!row) return { principal: net, interest: 0 };

  const p = Number(row.principal_amount || 0);
  const i = Number(row.interest_amount || 0);
  const total = p + i;
  if (total <= 0) return { principal: net, interest: 0 };

  const principal = round2((p / total) * net);
  const interest = round2(net - principal);
  return { principal, interest };
}

// ─── QBO connection ─────────────────────────────────────────────────────────

/**
 * Resolve the active QBO connection. Payouts aren't user-scoped, so we use
 * the single active connection (admin). If none is active, sync is skipped.
 */
async function getActiveQboConnection() {
  const { data: connection } = await supabase
    .from("qbo_connections")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!connection) return null;

  const tokenExpiry = new Date(connection.token_expires_at);
  if (tokenExpiry > new Date(Date.now() + 60_000)) return connection;

  // Refresh.
  const QBO_CLIENT_ID = Deno.env.get("QBO_CLIENT_ID")!;
  const QBO_CLIENT_SECRET = Deno.env.get("QBO_CLIENT_SECRET")!;
  const basicAuth = btoa(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`);

  const tokenResp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }),
  });

  if (!tokenResp.ok) {
    await supabase.from("qbo_connections").update({ is_active: false }).eq("id", connection.id);
    throw new Error(`QBO token refresh failed: ${await tokenResp.text()}`);
  }

  const tokens = await tokenResp.json();
  connection.access_token = tokens.access_token;
  connection.refresh_token = tokens.refresh_token;
  await supabase
    .from("qbo_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("id", connection.id);

  return connection;
}

async function getMappedAccountId(role: string): Promise<string> {
  const { data, error } = await supabase
    .from("qbo_account_mappings")
    .select("qbo_account_id")
    .eq("role", role)
    .maybeSingle();
  if (error) throw new Error(`qbo_account_mappings lookup failed (${role}): ${error.message}`);
  if (!data?.qbo_account_id) {
    throw new Error(
      `No QBO account mapped for role "${role}". Configure in Settings → QuickBooks → Account Mapping.`,
    );
  }
  return data.qbo_account_id;
}

/** Create a QBO Transfer between two accounts. Returns the new Transfer Id. */
async function createQboTransfer(
  qboBase: string,
  qboHeaders: Record<string, string>,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  txnDate: string,
  memo: string,
): Promise<string> {
  const body = {
    FromAccountRef: { value: fromAccountId },
    ToAccountRef: { value: toAccountId },
    Amount: Number(amount.toFixed(2)),
    TxnDate: txnDate,
    PrivateNote: memo,
  };
  const r = await fetch(`${qboBase}/transfer`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`QBO Transfer failed (${fromAccountId} → ${toAccountId}): ${await r.text()}`);
  const j = await r.json();
  const id = j?.Transfer?.Id;
  if (!id) throw new Error(`QBO Transfer response missing Id: ${JSON.stringify(j)}`);
  return id;
}

// ─── Main payout handler ────────────────────────────────────────────────────

async function processPayoutPaid(payout: Stripe.Payout) {
  log("processing payout.paid", { id: payout.id });

  // Guard: manual payouts are initiated by hand in the Stripe dashboard
  // and cannot be deterministically tied to a batch of balance transactions
  // here. Skip them so we don't post bogus QBO transfers.
  if (!payout.automatic) {
    log("skipping manual payout", { id: payout.id });
    await supabase.from("qbo_sync_logs").insert({
      sync_type: "auto-stripe-payout",
      direction: "push",
      status: "skipped_manual_payout",
      records_processed: 0,
      idempotency_key: `stripe_payout:${payout.id}`,
      error_message: "Manual payouts cannot be reconciled programmatically",
      details: {
        payout_id: payout.id,
        amount: payout.amount / 100,
        arrival_date: new Date(payout.arrival_date * 1000).toISOString().split("T")[0],
        method: payout.method,
        source_type: payout.source_type,
      },
    });
    return;
  }

  const buckets = await buildBuckets(payout.id);
  log("buckets", buckets);

  const arrival = new Date(payout.arrival_date * 1000).toISOString().split("T")[0];

  // Upsert the payout row with the breakdown so /qbo-health can render it
  // even when QBO is offline.
  const { data: savedPayout, error: upsertErr } = await supabase
    .from("stripe_payouts")
    .upsert(
      {
        stripe_payout_id: payout.id,
        amount: payout.amount / 100,
        net_amount: payout.amount / 100,
        arrival_date: arrival,
        status: payout.status,
        breakdown: buckets as unknown as Record<string, unknown>,
        raw_payload: payout as unknown as Record<string, unknown>,
      },
      { onConflict: "stripe_payout_id" },
    )
    .select("*")
    .single();

  if (upsertErr) throw new Error(`stripe_payouts upsert failed: ${upsertErr.message}`);

  const idemKey = `stripe_payout:${payout.id}`;

  // Already pushed successfully? Skip.
  const { data: prior } = await supabase
    .from("qbo_sync_logs")
    .select("id")
    .eq("idempotency_key", idemKey)
    .eq("status", "success")
    .maybeSingle();
  if (prior) {
    log("already synced to QBO; skipping", { payout: payout.id });
    return;
  }

  const connection = await getActiveQboConnection();
  if (!connection) {
    log("no active QBO connection; skipping push", { payout: payout.id });
    return;
  }

  const qboBase = `${QBO_BASE}/${connection.realm_id}`;
  const qboHeaders = {
    Authorization: `Bearer ${connection.access_token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // Resolve only the mappings we'll actually need.
  const needTrip = buckets.trip > 0;
  const needPrincipal = buckets.loan_principal > 0;
  const needInterest = buckets.loan_interest > 0;

  if (!needTrip && !needPrincipal && !needInterest) {
    await supabase.from("qbo_sync_logs").insert({
      user_id: connection.user_id,
      sync_type: "auto-stripe-payout",
      direction: "push",
      status: "skipped",
      records_processed: 0,
      idempotency_key: idemKey,
      details: { reason: "no_classified_amounts", payout_id: payout.id, breakdown: buckets },
    });
    return;
  }

  const operatingBank = await getMappedAccountId("operating_bank");
  const tripClearing = needTrip ? await getMappedAccountId("trip_clearing") : null;
  const principalClearing = needPrincipal ? await getMappedAccountId("loan_principal_clearing") : null;
  const interestClearing = needInterest ? await getMappedAccountId("loan_interest_clearing") : null;

  let tripTransferId: string | null = savedPayout.qbo_trip_transfer_id || null;
  let principalTransferId: string | null = savedPayout.qbo_loan_principal_transfer_id || null;
  let interestTransferId: string | null = savedPayout.qbo_loan_interest_transfer_id || null;

  try {
    if (needTrip && !tripTransferId) {
      tripTransferId = await createQboTransfer(
        qboBase, qboHeaders, tripClearing!, operatingBank,
        buckets.trip, arrival,
        `Stripe payout ${payout.id} • Trip clearing → operating bank`,
      );
    }
    if (needPrincipal && !principalTransferId) {
      principalTransferId = await createQboTransfer(
        qboBase, qboHeaders, principalClearing!, operatingBank,
        buckets.loan_principal, arrival,
        `Stripe payout ${payout.id} • Loan principal clearing → operating bank`,
      );
    }
    if (needInterest && !interestTransferId) {
      interestTransferId = await createQboTransfer(
        qboBase, qboHeaders, interestClearing!, operatingBank,
        buckets.loan_interest, arrival,
        `Stripe payout ${payout.id} • Loan interest clearing → operating bank`,
      );
    }

    await supabase
      .from("stripe_payouts")
      .update({
        qbo_trip_transfer_id: tripTransferId,
        qbo_loan_principal_transfer_id: principalTransferId,
        qbo_loan_interest_transfer_id: interestTransferId,
        qbo_synced_at: new Date().toISOString(),
        reconciled: true,
      })
      .eq("id", savedPayout.id);

    await supabase.from("qbo_sync_logs").insert({
      user_id: connection.user_id,
      sync_type: "auto-stripe-payout",
      direction: "push",
      status: "success",
      records_processed: [tripTransferId, principalTransferId, interestTransferId].filter(Boolean).length,
      idempotency_key: idemKey,
      details: {
        payout_id: payout.id,
        breakdown: buckets,
        trip_transfer_id: tripTransferId,
        loan_principal_transfer_id: principalTransferId,
        loan_interest_transfer_id: interestTransferId,
      },
    });
  } catch (err) {
    // Persist whatever transfers succeeded so a retry doesn't double-post.
    await supabase
      .from("stripe_payouts")
      .update({
        qbo_trip_transfer_id: tripTransferId,
        qbo_loan_principal_transfer_id: principalTransferId,
        qbo_loan_interest_transfer_id: interestTransferId,
      })
      .eq("id", savedPayout.id);

    const partial = Boolean(tripTransferId || principalTransferId || interestTransferId);
    await supabase.from("qbo_sync_logs").insert({
      user_id: connection.user_id,
      sync_type: "auto-stripe-payout",
      direction: "push",
      status: partial ? "pending_rollback" : "error",
      records_processed: [tripTransferId, principalTransferId, interestTransferId].filter(Boolean).length,
      error_message: (err as Error).message,
      idempotency_key: idemKey,
      details: {
        payout_id: payout.id,
        breakdown: buckets,
        trip_transfer_id: tripTransferId,
        loan_principal_transfer_id: principalTransferId,
        loan_interest_transfer_id: interestTransferId,
      },
    });
    throw err;
  }
}

// ─── HTTP entrypoint ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "stripe-signature, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET);
  } catch (err) {
    log("signature verification failed", { error: (err as Error).message });
    return new Response(`Invalid signature: ${(err as Error).message}`, { status: 400 });
  }

  // Idempotency at the webhook layer.
  const { error: dupErr } = await supabase
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed: false,
    });
  if (dupErr && !String(dupErr.message).includes("duplicate")) {
    log("webhook event insert failed", dupErr);
  }

  try {
    if (event.type === "payout.paid") {
      await processPayoutPaid(event.data.object as Stripe.Payout);
    } else {
      log("ignoring event type", { type: event.type });
    }

    await supabase
      .from("stripe_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    log("handler error", { error: (err as Error).message });
    await supabase
      .from("stripe_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error: (err as Error).message,
      })
      .eq("stripe_event_id", event.id);
    // Return 200 so Stripe doesn't infinitely retry — the qbo_sync_logs row
    // captures the failure for /qbo-health to surface.
    return new Response(
      JSON.stringify({ received: true, error: (err as Error).message }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
});
