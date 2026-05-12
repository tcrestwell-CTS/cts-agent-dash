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
    log("no payment_type metadata — skipping CRM routing", { id: pi.id });
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
    event = stripe.webhooks.constructEvent(body, sig!, WEBHOOK_SECRET);
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
