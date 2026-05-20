// supabase/functions/stripe-webhook/index.ts
// Ingests Stripe events into stripe_webhook_events + stripe_payments/refunds/disputes/payouts
// Idempotency: stripe_event_id must be unique — duplicate events are silently ignored
//
// ARCHITECTURE: This webhook NEVER writes to QBO directly.
// It only mutates CRM rows (trip_payments, loan_payment_schedules, stripe_payments).
// Marking a CRM row paid fires DB triggers → qbo-sync-trigger → QBO push.
// QBO is downstream-only; the CRM is the single system of record.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const log = (step: string, data?: unknown) =>
  console.log(`[stripe-webhook] ${step}`, data ? JSON.stringify(data) : "");

async function markProcessed(eventId: string, error?: string) {
  await supabase
    .from("stripe_webhook_events")
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      ...(error ? { error } : {}),
    })
    .eq("stripe_event_id", eventId);
}

async function sendToDeadLetter(eventType: string, payload: unknown, error: string) {
  await supabase.from("recon_dead_letter_queue").insert({
    source_system: "stripe",
    event_type: eventType,
    payload,
    error_message: error,
    retry_count: 0,
    status: "failed",
  });
}

async function processPaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  log("processing payment_intent.succeeded", { id: pi.id });

  let stripeFee = 0;
  let chargeId = "";
  if (pi.latest_charge) {
    chargeId = typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : pi.latest_charge.id;

    try {
      const charge = await stripe.charges.retrieve(chargeId, {
        expand: ["balance_transaction"],
      });
      const bt = charge.balance_transaction as Stripe.BalanceTransaction;
      if (bt?.fee) stripeFee = bt.fee / 100;
    } catch (e) {
      log("could not retrieve charge fee", e);
    }
  }

  const grossAmount = pi.amount / 100;
  const netAmount = grossAmount - stripeFee;
  const invoiceNumber = pi.metadata?.invoice_number || null;

  let crmBookingId = null;
  let crmClientId = null;
  if (invoiceNumber) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, client_id")
      .or(`confirmation_number.eq.${invoiceNumber},id.eq.${invoiceNumber}`)
      .maybeSingle();

    if (booking) {
      crmBookingId = booking.id;
      crmClientId = booking.client_id;
      log("matched to CRM booking", { bookingId: crmBookingId });
    }
  }

  const { error } = await supabase.from("stripe_payments").upsert(
    {
      stripe_payment_intent_id: pi.id,
      stripe_charge_id: chargeId || null,
      stripe_customer_id: typeof pi.customer === "string" ? pi.customer : null,
      invoice_number: invoiceNumber,
      crm_booking_id: crmBookingId,
      crm_client_id: crmClientId,
      gross_amount: grossAmount,
      stripe_fee: stripeFee,
      net_amount: netAmount,
      currency: pi.currency,
      status: "succeeded",
      payment_method: pi.metadata?.payment_method || null,
      customer_email: pi.receipt_email || null,
      customer_name: pi.shipping?.name || null,
      stripe_created_at: new Date(pi.created * 1000).toISOString(),
      raw_payload: pi as unknown as Record<string, unknown>,
    },
    { onConflict: "stripe_payment_intent_id" }
  );

  if (error) throw new Error(`stripe_payments upsert failed: ${error.message}`);
  log("stripe_payments upserted", { id: pi.id });

  const { error: checkoutUpdateError } = await supabase
    .from("checkout_payments")
    .update({
      status: "succeeded",
      stripe_customer_id: typeof pi.customer === "string" ? pi.customer : null,
    })
    .eq("stripe_payment_intent_id", pi.id);
  if (checkoutUpdateError) {
    throw new Error(`checkout_payments status update failed: ${checkoutUpdateError.message}`);
  }
  log("checkout_payments synced", { payment_intent_id: pi.id });

  // ── CRM routing by metadata.payment_type ─────────────────────────────────
  await routePaymentToCrm(pi);
}

/**
 * Routes a successful Stripe PaymentIntent to the appropriate CRM row.
 * Reads pi.metadata.payment_type ("trip_installment" | "loan_repayment").
 * For subscription-driven invoices (loan autopay), falls back to subscription metadata.
 */
async function routePaymentToCrm(pi: Stripe.PaymentIntent) {
  let meta: Record<string, string> = (pi.metadata as Record<string, string>) || {};

  // Subscription invoices: PI metadata is empty — pull from subscription metadata.
  if (!meta.payment_type && pi.invoice) {
    try {
      const invoiceId = typeof pi.invoice === "string" ? pi.invoice : pi.invoice.id;
      const invoice = await stripe.invoices.retrieve(invoiceId);
      const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        meta = { ...((sub.metadata as Record<string, string>) || {}), ...meta };
      }
    } catch (e) {
      log("subscription metadata lookup failed", e);
    }
  }

  const paymentType = meta.payment_type;
  if (!paymentType) {
    log("no payment_type metadata — falling back to email match", { id: pi.id });
    await tryEmailFallbackMatch(pi);
    return;
  }

  if (paymentType === "trip_installment") {
    const tripPaymentId = meta.trip_payment_id;
    if (!tripPaymentId) {
      log("trip_installment missing trip_payment_id metadata", { id: pi.id });
      return;
    }
    const { error } = await supabase
      .from("trip_payments")
      .update({
        status: "paid",
        payment_date: new Date(pi.created * 1000).toISOString().split("T")[0],
        stripe_payment_intent_id: pi.id,
      })
      .eq("id", tripPaymentId)
      .neq("status", "paid"); // idempotent
    if (error) throw new Error(`trip_payments paid update failed: ${error.message}`);
    log("trip_payments marked paid", { trip_payment_id: tripPaymentId });
    return;
  }

  if (paymentType === "loan_repayment") {
    const loanId = meta.loan_id;
    const installmentNo = meta.installment_no ? Number(meta.installment_no) : null;

    let scheduleId: string | null = null;

    if (loanId && installmentNo != null) {
      const { data: row } = await supabase
        .from("loan_payment_schedules")
        .select("id")
        .eq("loan_application_id", loanId)
        .eq("payment_number", installmentNo)
        .maybeSingle();
      scheduleId = row?.id || null;
    }

    // Subscription autopay flow: no installment_no — pick the next pending installment for this loan.
    if (!scheduleId && loanId) {
      const { data: row } = await supabase
        .from("loan_payment_schedules")
        .select("id")
        .eq("loan_application_id", loanId)
        .eq("status", "pending")
        .order("payment_number", { ascending: true })
        .limit(1)
        .maybeSingle();
      scheduleId = row?.id || null;
    }

    if (!scheduleId) {
      log("loan_repayment could not locate matching schedule", { loanId, installmentNo, pi: pi.id });
      return;
    }

    const { error } = await supabase
      .from("loan_payment_schedules")
      .update({
        status: "paid",
        paid_date: new Date(pi.created * 1000).toISOString().split("T")[0],
        stripe_payment_intent_id: pi.id,
      })
      .eq("id", scheduleId)
      .neq("status", "paid");
    if (error) throw new Error(`loan_payment_schedules paid update failed: ${error.message}`);
    log("loan_payment_schedules marked paid", { schedule_id: scheduleId });
    return;
  }

  log("unknown payment_type — skipping", { paymentType, id: pi.id });
}

/**
 * Email-as-key fallback used when a Stripe payment arrives without
 * `metadata.trip_payment_id` (generic payment link, website checkout, etc.).
 *
 * Strategy:
 *   1. Resolve the payer's email (checkout_payments → pi.receipt_email → charge billing).
 *   2. Find all CRM clients matching that email.
 *   3. Gather distinct active trips across those clients (excluding cancelled/archived/completed).
 *   4. If EXACTLY ONE active trip → auto-apply to the oldest pending trip_payment.
 *      If MULTIPLE active trips → leave unattributed, notify assigned agent(s) to confirm.
 *      If NONE → leave unattributed.
 */
async function tryEmailFallbackMatch(pi: Stripe.PaymentIntent) {
  // 1. Resolve email
  let email: string | null = null;
  const { data: cp } = await supabase
    .from("checkout_payments")
    .select("id, customer_email, customer_name, trip_name, booking_ref")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();
  email = cp?.customer_email || pi.receipt_email || null;

  if (!email && pi.latest_charge) {
    try {
      const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge.id;
      const charge = await stripe.charges.retrieve(chargeId);
      email = charge.billing_details?.email || charge.receipt_email || null;
    } catch (e) {
      log("email lookup via charge failed", e);
    }
  }

  if (!email) {
    log("email fallback: no email found, leaving unattributed", { id: pi.id });
    return;
  }

  const emailLc = email.toLowerCase();

  // 2. Find matching clients (case-insensitive)
  const { data: clients } = await supabase
    .from("clients")
    .select("id, assigned_agent_id, name, email")
    .ilike("email", emailLc);

  if (!clients || clients.length === 0) {
    log("email fallback: no client found for email", { email: emailLc, id: pi.id });
    return;
  }

  const clientIds = clients.map((c) => c.id);

  // 3. Gather active trips for those clients
  const { data: trips } = await supabase
    .from("trips")
    .select("id, trip_name, status, updated_at, client_id")
    .in("client_id", clientIds)
    .not("status", "in", "(cancelled,archived,completed)");

  if (!trips || trips.length === 0) {
    log("email fallback: no active trips for email", { email: emailLc, id: pi.id });
    return;
  }

  // 4. Disambiguate when more than one active trip
  let trip = trips[0];
  let disambiguatedBy: string | null = null;

  if (trips.length > 1) {
    // 4a. Try booking_ref → invoice → trip (strongest signal)
    if (cp?.booking_ref) {
      // Strip "-NN" suffix (e.g. "INV-2026-00057-01" → "INV-2026-00057")
      const invoiceNumber = cp.booking_ref.replace(/-\d+$/, "");
      const { data: inv } = await supabase
        .from("invoices")
        .select("trip_id")
        .eq("invoice_number", invoiceNumber)
        .maybeSingle();
      const matchedByInvoice = inv?.trip_id ? trips.find((t) => t.id === inv.trip_id) : null;
      if (matchedByInvoice) {
        trip = matchedByInvoice;
        disambiguatedBy = "booking_ref/invoice";
      }
    }

    // 4b. Try trip_name fuzzy match
    if (!disambiguatedBy && cp?.trip_name) {
      const tripNameLc = cp.trip_name.toLowerCase().trim();
      const matchedByName = trips.find(
        (t) =>
          t.trip_name &&
          (t.trip_name.toLowerCase() === tripNameLc ||
            t.trip_name.toLowerCase().includes(tripNameLc) ||
            tripNameLc.includes(t.trip_name.toLowerCase()))
      );
      if (matchedByName) {
        trip = matchedByName;
        disambiguatedBy = "trip_name";
      }
    }

    // 4c. Try customer_name → narrow to one client → if that client has exactly one active trip
    if (!disambiguatedBy && cp?.customer_name) {
      const nameLc = cp.customer_name.toLowerCase().trim();
      const matchedClients = clients.filter(
        (c) => c.name && c.name.toLowerCase().trim() === nameLc
      );
      if (matchedClients.length === 1) {
        const tripsForClient = trips.filter((t) => t.client_id === matchedClients[0].id);
        if (tripsForClient.length === 1) {
          trip = tripsForClient[0];
          disambiguatedBy = "customer_name";
        }
      }
    }

    // 4d. Still ambiguous → leave unattributed, notify agent(s)
    if (!disambiguatedBy) {
      log("email fallback: multiple active trips, could not disambiguate", {
        email: emailLc,
        tripCount: trips.length,
      });

      const agentIds = Array.from(
        new Set(clients.map((c) => c.assigned_agent_id).filter(Boolean) as string[])
      );
      const amount = (pi.amount / 100).toFixed(2);
      for (const userId of agentIds) {
        await supabase.from("agent_notifications").insert({
          user_id: userId,
          type: "payment_needs_attribution",
          title: "Payment needs attribution",
          message: `A $${amount} payment from ${email} matches a client with ${trips.length} active trips. Open Unmatched Review to assign it to the right installment.`,
        });
      }
      return;
    }

    log("email fallback: disambiguated", { by: disambiguatedBy, tripId: trip.id });
  }

  // 5. Auto-apply to oldest pending installment on the chosen trip
  const matchedClient = clients.find((c) => c.id === trip.client_id) || clients[0];

  const { data: pending } = await supabase
    .from("trip_payments")
    .select("id, amount, due_date, created_at, user_id")
    .eq("trip_id", trip.id)
    .eq("status", "pending")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (!pending || pending.length === 0) {
    log("email fallback: no pending installments on matched trip", {
      email: emailLc,
      tripId: trip.id,
    });
    if (matchedClient.assigned_agent_id) {
      const amount = (pi.amount / 100).toFixed(2);
      await supabase.from("agent_notifications").insert({
        user_id: matchedClient.assigned_agent_id,
        type: "payment_needs_attribution",
        title: "Payment received with no pending installment",
        message: `A $${amount} payment from ${email} matches trip "${trip.trip_name}" but no pending installment exists. Review in Unmatched payments.`,
        trip_id: trip.id,
      });
    }
    return;
  }

  const installment = pending[0];
  const paymentDate = new Date(pi.created * 1000).toISOString().split("T")[0];

  const { error: tpErr } = await supabase
    .from("trip_payments")
    .update({
      status: "paid",
      payment_date: paymentDate,
      stripe_payment_intent_id: pi.id,
    })
    .eq("id", installment.id)
    .neq("status", "paid");

  if (tpErr) {
    log("email fallback: trip_payments update failed", tpErr.message);
    return;
  }

  // Stamp the checkout_payments row so Unmatched Review hides it
  if (cp?.id) {
    await supabase
      .from("checkout_payments")
      .update({
        trip_payment_id: installment.id,
        trip_id: trip.id,
        agent_user_id: matchedClient.assigned_agent_id || installment.user_id,
        payment_type: "trip_installment",
      })
      .eq("id", cp.id);
  }

  log("email fallback: auto-applied payment", {
    email: emailLc,
    tripId: trip.id,
    tripPaymentId: installment.id,
    pi: pi.id,
  });

  // Notify agent of auto-match
  if (matchedClient.assigned_agent_id) {
    const amount = (pi.amount / 100).toFixed(2);
    await supabase.from("agent_notifications").insert({
      user_id: matchedClient.assigned_agent_id,
      type: "payment_auto_matched",
      title: "Payment auto-matched by email",
      message: `A $${amount} payment from ${email} was auto-applied to the next installment for "${trip.trip_name}".`,
      trip_id: trip.id,
      trip_payment_id: installment.id,
    });
  }
}

async function processChargeRefunded(charge: Stripe.Charge) {
  log("processing charge.refunded", { id: charge.id });

  const { data: payment } = await supabase
    .from("stripe_payments")
    .select("id")
    .eq("stripe_charge_id", charge.id)
    .maybeSingle();

  for (const refund of charge.refunds?.data || []) {
    const { error } = await supabase.from("stripe_refunds").upsert(
      {
        stripe_refund_id: refund.id,
        stripe_payment_intent_id: typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : null,
        stripe_charge_id: charge.id,
        stripe_payment_id: payment?.id || null,
        amount: refund.amount / 100,
        reason: refund.reason || null,
        status: refund.status,
        raw_payload: refund as unknown as Record<string, unknown>,
      },
      { onConflict: "stripe_refund_id" }
    );
    if (error) throw new Error(`stripe_refunds upsert failed: ${error.message}`);
  }

  if (payment) {
    await supabase
      .from("stripe_payments")
      .update({ status: "refunded" })
      .eq("id", payment.id);
  }
}

async function processDisputeCreated(dispute: Stripe.Dispute) {
  log("processing dispute", { id: dispute.id });

  const chargeId = typeof dispute.charge === "string"
    ? dispute.charge
    : dispute.charge?.id;

  const { data: payment } = await supabase
    .from("stripe_payments")
    .select("id")
    .eq("stripe_charge_id", chargeId)
    .maybeSingle();

  const { error } = await supabase.from("stripe_disputes").upsert(
    {
      stripe_dispute_id: dispute.id,
      stripe_charge_id: chargeId || null,
      stripe_payment_id: payment?.id || null,
      amount: dispute.amount / 100,
      reason: dispute.reason,
      status: dispute.status,
      raw_payload: dispute as unknown as Record<string, unknown>,
    },
    { onConflict: "stripe_dispute_id" }
  );

  if (error) throw new Error(`stripe_disputes upsert failed: ${error.message}`);

  await supabase.from("exception_queue").insert({
    exception_type: "stripe_dispute",
    source_system: "stripe",
    source_record_id: dispute.id,
    source_record_type: "dispute",
    description: `Stripe dispute ${dispute.id} — reason: ${dispute.reason}, amount: $${dispute.amount / 100}`,
    amount: dispute.amount / 100,
    status: "open",
  });
}

async function processPayoutPaid(payout: Stripe.Payout) {
  log("processing payout.paid", { id: payout.id });

  const balanceTxns = await stripe.balanceTransactions.list({
    payout: payout.id,
    limit: 100,
    type: "charge",
  });

  let feeTotal = 0;
  const paymentLinks: Array<{
    paymentIntentId: string;
    grossAmount: number;
    feeAmount: number;
    netContribution: number;
  }> = [];

  for (const txn of balanceTxns.data) {
    feeTotal += txn.fee / 100;
    if (txn.source && typeof txn.source === "string") {
      paymentLinks.push({
        paymentIntentId: txn.source,
        grossAmount: txn.amount / 100,
        feeAmount: txn.fee / 100,
        netContribution: txn.net / 100,
      });
    }
  }

  const { data: savedPayout, error } = await supabase
    .from("stripe_payouts")
    .upsert(
      {
        stripe_payout_id: payout.id,
        amount: payout.amount / 100,
        fee_total: feeTotal,
        refund_total: 0,
        net_amount: payout.amount / 100,
        arrival_date: new Date(payout.arrival_date * 1000)
          .toISOString()
          .split("T")[0],
        status: payout.status,
        reconciled: false,
        raw_payload: payout as unknown as Record<string, unknown>,
      },
      { onConflict: "stripe_payout_id" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`stripe_payouts upsert failed: ${error.message}`);

  for (const link of paymentLinks) {
    const { data: sp } = await supabase
      .from("stripe_payments")
      .select("id")
      .eq("stripe_charge_id", link.paymentIntentId)
      .maybeSingle();

    if (sp && savedPayout) {
      await supabase.from("stripe_payout_payments").upsert(
        {
          stripe_payout_id: savedPayout.id,
          stripe_payment_id: sp.id,
          gross_amount: link.grossAmount,
          fee_amount: link.feeAmount,
          net_contribution: link.netContribution,
        },
        { onConflict: "stripe_payout_id,stripe_payment_id" }
      );
    }
  }
}

async function processPayoutFailed(payout: Stripe.Payout) {
  log("processing payout.failed", { id: payout.id });

  await supabase.from("stripe_payouts").upsert(
    {
      stripe_payout_id: payout.id,
      amount: payout.amount / 100,
      net_amount: payout.amount / 100,
      arrival_date: new Date(payout.arrival_date * 1000)
        .toISOString()
        .split("T")[0],
      status: "failed",
      raw_payload: payout as unknown as Record<string, unknown>,
    },
    { onConflict: "stripe_payout_id" }
  );

  await supabase.from("exception_queue").insert({
    exception_type: "failed_payout",
    source_system: "stripe",
    source_record_id: payout.id,
    source_record_type: "payout",
    description: `Stripe payout ${payout.id} failed — $${payout.amount / 100}`,
    amount: payout.amount / 100,
    status: "open",
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, WEBHOOK_SECRET);
  } catch (err) {
    log("webhook signature verification failed", err);
    return new Response("Webhook signature invalid", { status: 400 });
  }

  log("received event", { type: event.type, id: event.id });

  const { data: existing } = await supabase
    .from("stripe_webhook_events")
    .select("id, processed")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.processed) {
    log("duplicate event — already processed", { id: event.id });
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  await supabase.from("stripe_webhook_events").upsert(
    {
      stripe_event_id: event.id,
      event_type: event.type,
      processed: false,
      raw_payload: event as unknown as Record<string, unknown>,
    },
    { onConflict: "stripe_event_id" }
  );

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await processPaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case "charge.refunded":
        await processChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
      case "charge.dispute.closed":
        await processDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "payout.paid":
        await processPayoutPaid(event.data.object as Stripe.Payout);
        break;

      case "payout.failed":
        await processPayoutFailed(event.data.object as Stripe.Payout);
        break;

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await supabase.from("exception_queue").insert({
          exception_type: "unmatched_stripe_payment",
          source_system: "stripe",
          source_record_id: pi.id,
          source_record_type: "payment_intent",
          description: `Payment failed: ${pi.id} — ${pi.last_payment_error?.message || "unknown error"}`,
          amount: pi.amount / 100,
          status: "open",
        });
        break;
      }

      default:
        log("unhandled event type — skipping", { type: event.type });
    }

    await markProcessed(event.id);
    log("event processed successfully", { id: event.id });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log("error processing event", { id: event.id, error: errMsg });
    await markProcessed(event.id, errMsg);
    await sendToDeadLetter(event.type, event, errMsg);

    return new Response(
      JSON.stringify({ received: true, error: errMsg }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
