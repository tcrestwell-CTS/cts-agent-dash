// supabase/functions/recon-engine/index.ts
// Matches CRM bookings/payments/supplier payments against QBO cache and Stripe
// Scores confidence, creates recon_matches and exception_queue entries
// NEVER writes to QBO — that is recon-approvals job

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const log = (step: string, data?: unknown) =>
  console.log(`[recon-engine] ${step}`, data ? JSON.stringify(data) : "");

interface ReconConfig {
  amount_tolerance: number;
  date_window_days: number;
  auto_match_threshold: number;
  approval_required_above: number;
}

async function getConfig(): Promise<ReconConfig> {
  const { data } = await supabase
    .from("recon_account_config")
    .select("*")
    .eq("company_id", "crestwell")
    .maybeSingle();
  return (data as ReconConfig) || {
    amount_tolerance: 1.00,
    date_window_days: 3,
    auto_match_threshold: 95,
    approval_required_above: 500.00,
  };
}

interface ScoreResult {
  score: number;
  breakdown: Record<string, number>;
  explanation: string[];
}

function scoreMatch(
  crmAmount: number | null,
  qboAmount: number | null,
  stripeAmount: number | null,
  crmDate: string | null,
  qboDate: string | null,
  stripeDate: string | null,
  invoiceMatch: boolean,
  customerMatch: boolean,
  metadataMatch: boolean,
  config: ReconConfig
): ScoreResult {
  let score = 0;
  const breakdown: Record<string, number> = {};
  const explanation: string[] = [];

  if (metadataMatch) {
    breakdown.metadata = 30; score += 30;
    explanation.push("Source IDs / metadata matched");
  }
  if (invoiceMatch) {
    breakdown.invoice = 25; score += 25;
    explanation.push("Invoice/reference number matched");
  }

  const amounts = [crmAmount, qboAmount, stripeAmount].filter((a) => a !== null) as number[];
  if (amounts.length >= 2) {
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const variance = max - min;
    if (variance === 0) {
      breakdown.amount = 25; score += 25;
      explanation.push(`Exact amount match: $${min}`);
    } else if (variance <= config.amount_tolerance) {
      breakdown.amount = 15; score += 15;
      explanation.push(`Amount within tolerance: $${min}–$${max} (variance $${variance.toFixed(2)})`);
    } else {
      breakdown.amount = 0;
      explanation.push(`Amount mismatch: $${min} vs $${max} (variance $${variance.toFixed(2)})`);
    }
  }

  if (customerMatch) {
    breakdown.customer = 10; score += 10;
    explanation.push("Customer/vendor matched");
  }

  const dates = [crmDate, qboDate, stripeDate].filter(Boolean) as string[];
  if (dates.length >= 2) {
    const timestamps = dates.map((d) => new Date(d).getTime());
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const daysDiff = (maxTs - minTs) / (1000 * 60 * 60 * 24);
    if (daysDiff <= config.date_window_days) {
      breakdown.date = 10; score += 10;
      explanation.push(`Date within ${config.date_window_days}-day window (${daysDiff.toFixed(1)} days)`);
    } else {
      breakdown.date = 0;
      explanation.push(`Date outside window: ${daysDiff.toFixed(1)} days apart`);
    }
  }

  return { score, breakdown, explanation };
}

async function matchBookingsToInvoices(config: ReconConfig) {
  log("matching bookings to QBO invoices");

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, client_id, confirmation_number, total_price, created_at, status")
    .in("status", ["confirmed", "completed"])
    .limit(200);

  if (!bookings?.length) return;

  for (const booking of bookings) {
    const { data: existing } = await supabase
      .from("recon_matches")
      .select("id")
      .eq("crm_booking_id", booking.id)
      .eq("match_type", "crm_booking_to_qbo_invoice")
      .maybeSingle();

    if (existing) continue;

    const orFilter = booking.confirmation_number
      ? `doc_number.eq.${booking.confirmation_number},crm_booking_id.eq.${booking.id}`
      : `crm_booking_id.eq.${booking.id}`;

    const { data: qboInvoice } = await supabase
      .from("qbo_invoices")
      .select("*")
      .or(orFilter)
      .maybeSingle();

    const { data: qboCustomer } = await supabase
      .from("qbo_customers")
      .select("qbo_id")
      .eq("crm_client_id", booking.client_id)
      .maybeSingle();

    if (qboInvoice) {
      const { score, breakdown, explanation } = scoreMatch(
        booking.total_price,
        qboInvoice.total_amt,
        null,
        booking.created_at?.split("T")[0],
        qboInvoice.txn_date,
        null,
        !!booking.confirmation_number && qboInvoice.doc_number === booking.confirmation_number,
        !!qboCustomer,
        !!qboInvoice.crm_booking_id,
        config
      );

      await supabase.from("recon_matches").insert({
        match_type: "crm_booking_to_qbo_invoice",
        crm_booking_id: booking.id,
        qbo_invoice_id: qboInvoice.id,
        confidence_score: score,
        score_breakdown: breakdown,
        match_explanation: explanation.join("; "),
        crm_amount: booking.total_price,
        qbo_amount: qboInvoice.total_amt,
        amount_variance: Math.abs((booking.total_price || 0) - (qboInvoice.total_amt || 0)),
        crm_date: booking.created_at?.split("T")[0],
        qbo_date: qboInvoice.txn_date,
        status: score >= config.auto_match_threshold ? "approved" : "new",
        recommended_action: score >= config.auto_match_threshold ? "No action needed — matched" : "Review match",
        auto_matched: score >= config.auto_match_threshold,
      });
    } else {
      const { data: existingEx } = await supabase
        .from("exception_queue")
        .select("id")
        .eq("source_record_id", booking.id)
        .eq("exception_type", "missing_qbo_invoice")
        .maybeSingle();

      if (!existingEx) {
        await supabase.from("exception_queue").insert({
          exception_type: "missing_qbo_invoice",
          source_system: "crm",
          source_record_id: booking.id,
          source_record_type: "booking",
          description: `Booking ${booking.confirmation_number || booking.id} has no matching QBO Invoice`,
          amount: booking.total_price,
          status: "open",
        });
      }
    }
  }

  log("booking → invoice matching complete");
}

async function matchStripePayments(config: ReconConfig) {
  log("matching Stripe payments");

  const { data: stripePayments } = await supabase
    .from("stripe_payments").select("*")
    .eq("status", "succeeded").is("crm_booking_id", null).limit(200);

  const { data: stripePaymentsMatched } = await supabase
    .from("stripe_payments").select("*")
    .eq("status", "succeeded").not("crm_booking_id", "is", null).limit(200);

  const allPayments = [...(stripePayments || []), ...(stripePaymentsMatched || [])];

  for (const sp of allPayments) {
    const { data: existing } = await supabase
      .from("recon_matches")
      .select("id")
      .eq("stripe_payment_id", sp.id)
      .eq("match_type", "stripe_payment_to_qbo_payment")
      .maybeSingle();

    if (existing) continue;

    let crmBookingId = sp.crm_booking_id;
    if (!crmBookingId && sp.invoice_number) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, client_id, total_price, created_at")
        .eq("confirmation_number", sp.invoice_number)
        .maybeSingle();
      if (booking) {
        crmBookingId = booking.id;
        await supabase
          .from("stripe_payments")
          .update({ crm_booking_id: booking.id, crm_client_id: booking.client_id })
          .eq("id", sp.id);
      }
    }

    let qboPaymentQuery = supabase
      .from("qbo_payments")
      .select("*")
      .gte("total_amt", sp.gross_amount - config.amount_tolerance)
      .lte("total_amt", sp.gross_amount + config.amount_tolerance);

    const stripeDate = sp.stripe_created_at?.split("T")[0];
    if (stripeDate) {
      const dateFrom = new Date(new Date(stripeDate).getTime() - config.date_window_days * 86400000)
        .toISOString().split("T")[0];
      const dateTo = new Date(new Date(stripeDate).getTime() + config.date_window_days * 86400000)
        .toISOString().split("T")[0];
      qboPaymentQuery = qboPaymentQuery.gte("txn_date", dateFrom).lte("txn_date", dateTo);
    }

    const { data: qboPayment } = await qboPaymentQuery.maybeSingle();

    let qboInvoice: any = null;
    if (crmBookingId) {
      const { data: inv } = await supabase
        .from("qbo_invoices").select("*")
        .eq("crm_booking_id", crmBookingId).maybeSingle();
      qboInvoice = inv;
    }

    if (qboPayment) {
      const { score, breakdown, explanation } = scoreMatch(
        sp.gross_amount, qboPayment.total_amt, sp.gross_amount,
        stripeDate, qboPayment.txn_date, stripeDate,
        !!sp.invoice_number, true, false, config
      );

      await supabase.from("recon_matches").insert({
        match_type: "stripe_payment_to_qbo_payment",
        crm_booking_id: crmBookingId,
        stripe_payment_id: sp.id,
        qbo_payment_id: qboPayment.id,
        qbo_invoice_id: qboInvoice?.id || null,
        confidence_score: score,
        score_breakdown: breakdown,
        match_explanation: explanation.join("; "),
        crm_amount: sp.gross_amount,
        qbo_amount: qboPayment.total_amt,
        stripe_amount: sp.gross_amount,
        amount_variance: Math.abs(sp.gross_amount - qboPayment.total_amt),
        stripe_date: stripeDate,
        qbo_date: qboPayment.txn_date,
        status: score >= config.auto_match_threshold ? "approved" : "new",
        recommended_action: score >= config.auto_match_threshold ? "No action needed — matched" : "Review match",
        auto_matched: score >= config.auto_match_threshold,
      });
    } else {
      const { data: match } = await supabase
        .from("recon_matches")
        .insert({
          match_type: "stripe_payment_to_qbo_payment",
          crm_booking_id: crmBookingId,
          stripe_payment_id: sp.id,
          qbo_invoice_id: qboInvoice?.id || null,
          confidence_score: qboInvoice ? 60 : 30,
          match_explanation: qboInvoice
            ? "Stripe payment found, QBO Invoice exists but no QBO Payment recorded"
            : "Stripe payment found but no matching CRM booking or QBO Invoice",
          stripe_amount: sp.gross_amount,
          stripe_date: stripeDate,
          status: "new",
          recommended_action: "Create QBO Payment",
        })
        .select("id")
        .single();

      if (match && qboInvoice) {
        await supabase.from("approval_tasks").insert({
          recon_match_id: match.id,
          action_type: "create_qbo_payment",
          action_payload: {
            CustomerRef: { value: qboInvoice.qbo_customer_id },
            TotalAmt: sp.gross_amount,
            TxnDate: stripeDate,
            PaymentRefNum: sp.stripe_payment_intent_id,
            PrivateNote: `Created by QBO Reconciliation Agent. Source: stripe, Source ID: ${sp.stripe_payment_intent_id}, Match ID: ${match.id}`,
            Line: [{
              Amount: sp.gross_amount,
              LinkedTxn: [{ TxnId: qboInvoice.qbo_id, TxnType: "Invoice" }],
            }],
          },
          requires_admin: sp.gross_amount > config.approval_required_above,
          status: "pending",
        });
      } else {
        await supabase.from("exception_queue").insert({
          exception_type: "unmatched_stripe_payment",
          source_system: "stripe",
          source_record_id: sp.stripe_payment_intent_id,
          source_record_type: "payment_intent",
          description: `Stripe payment $${sp.gross_amount} (${sp.invoice_number || "no invoice"}) has no matching QBO Payment or Invoice`,
          amount: sp.gross_amount,
          status: "open",
        });
      }
    }
  }

  log("Stripe payment matching complete");
}

async function matchPayoutsToDeposits(config: ReconConfig) {
  log("matching Stripe payouts to QBO deposits");

  const { data: payouts } = await supabase
    .from("stripe_payouts").select("*")
    .eq("status", "paid").eq("reconciled", false).limit(50);

  for (const payout of payouts || []) {
    const { data: qboDeposit } = await supabase
      .from("qbo_deposits")
      .select("*")
      .gte("total_amt", payout.net_amount - config.amount_tolerance)
      .lte("total_amt", payout.net_amount + config.amount_tolerance)
      .gte("txn_date",
        new Date(new Date(payout.arrival_date).getTime() - config.date_window_days * 86400000)
          .toISOString().split("T")[0])
      .lte("txn_date",
        new Date(new Date(payout.arrival_date).getTime() + config.date_window_days * 86400000)
          .toISOString().split("T")[0])
      .maybeSingle();

    if (qboDeposit) {
      const { score, breakdown, explanation } = scoreMatch(
        null, qboDeposit.total_amt, payout.net_amount,
        null, qboDeposit.txn_date, payout.arrival_date,
        false, false, false, config
      );

      await supabase.from("recon_matches").insert({
        match_type: "stripe_payout_to_qbo_deposit",
        stripe_payout_id: payout.id,
        qbo_deposit_id: qboDeposit.id,
        confidence_score: score,
        score_breakdown: breakdown,
        match_explanation: explanation.join("; "),
        qbo_amount: qboDeposit.total_amt,
        stripe_amount: payout.net_amount,
        amount_variance: Math.abs(payout.net_amount - qboDeposit.total_amt),
        qbo_date: qboDeposit.txn_date,
        stripe_date: payout.arrival_date,
        status: score >= config.auto_match_threshold ? "approved" : "new",
        recommended_action: score >= config.auto_match_threshold ? "No action needed — matched" : "Review payout/deposit match",
        auto_matched: score >= config.auto_match_threshold,
      });

      await supabase
        .from("stripe_payouts")
        .update({ reconciled: true, qbo_deposit_id: qboDeposit.qbo_id })
        .eq("id", payout.id);
    } else {
      const { data: match } = await supabase
        .from("recon_matches")
        .insert({
          match_type: "stripe_payout_to_qbo_deposit",
          stripe_payout_id: payout.id,
          confidence_score: 0,
          stripe_amount: payout.net_amount,
          stripe_date: payout.arrival_date,
          status: "new",
          recommended_action: "Create QBO Deposit",
          match_explanation: `Stripe payout $${payout.net_amount} on ${payout.arrival_date} has no matching QBO Deposit`,
        })
        .select("id")
        .single();

      if (match) {
        await supabase.from("approval_tasks").insert({
          recon_match_id: match.id,
          action_type: "create_qbo_deposit",
          action_payload: {
            TxnDate: payout.arrival_date,
            TotalAmt: payout.net_amount,
            PrivateNote: `Created by QBO Reconciliation Agent. Source: stripe_payout, Source ID: ${payout.stripe_payout_id}, Match ID: ${match.id}`,
          },
          requires_admin: payout.net_amount > config.approval_required_above,
          status: "pending",
        });
      }
    }
  }

  log("payout → deposit matching complete");
}

async function matchSupplierPayments(config: ReconConfig) {
  log("matching supplier payments to QBO bills");

  const { data: supplierPayments } = await supabase
    .from("bookings")
    .select("id, supplier_id, supplier_payout, created_at, status, confirmation_number")
    .not("supplier_id", "is", null)
    .not("supplier_payout", "is", null)
    .in("status", ["confirmed", "completed"])
    .limit(200);

  for (const sp of supplierPayments || []) {
    const { data: existing } = await supabase
      .from("recon_matches")
      .select("id")
      .eq("crm_booking_id", sp.id)
      .eq("match_type", "crm_supplier_to_qbo_bill")
      .maybeSingle();

    if (existing) continue;

    const { data: vendorMapping } = await supabase
      .from("recon_entity_mappings")
      .select("qbo_id")
      .eq("mapping_type", "crm_supplier_to_qbo_vendor")
      .eq("crm_id", sp.supplier_id)
      .maybeSingle();

    let qboBill: any = null;
    if (vendorMapping?.qbo_id) {
      const { data: bill } = await supabase
        .from("qbo_bills")
        .select("*")
        .eq("qbo_vendor_id", vendorMapping.qbo_id)
        .gte("total_amt", (sp.supplier_payout || 0) - config.amount_tolerance)
        .lte("total_amt", (sp.supplier_payout || 0) + config.amount_tolerance)
        .maybeSingle();
      qboBill = bill;
    }

    if (qboBill) {
      const { score, breakdown, explanation } = scoreMatch(
        sp.supplier_payout, qboBill.total_amt, null,
        sp.created_at?.split("T")[0], qboBill.txn_date, null,
        !!sp.confirmation_number && qboBill.doc_number === sp.confirmation_number,
        !!vendorMapping, false, config
      );

      await supabase.from("recon_matches").insert({
        match_type: "crm_supplier_to_qbo_bill",
        crm_booking_id: sp.id,
        qbo_bill_id: qboBill.id,
        confidence_score: score,
        score_breakdown: breakdown,
        match_explanation: explanation.join("; "),
        crm_amount: sp.supplier_payout,
        qbo_amount: qboBill.total_amt,
        amount_variance: Math.abs((sp.supplier_payout || 0) - (qboBill.total_amt || 0)),
        crm_date: sp.created_at?.split("T")[0],
        qbo_date: qboBill.txn_date,
        status: score >= config.auto_match_threshold ? "approved" : "new",
        recommended_action: score >= config.auto_match_threshold ? "No action needed — matched" : "Review supplier/bill match",
        auto_matched: score >= config.auto_match_threshold,
      });
    } else {
      await supabase.from("exception_queue").insert({
        exception_type: "missing_qbo_bill",
        source_system: "crm",
        source_record_id: sp.id,
        source_record_type: "booking_supplier_cost",
        description: `Booking ${sp.confirmation_number || sp.id} supplier cost $${sp.supplier_payout} has no matching QBO Bill`,
        amount: sp.supplier_payout,
        status: "open",
      });
    }
  }

  log("supplier payment matching complete");
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = req.headers.get("x-agent-secret");
  const expected = Deno.env.get("AGENT_SECRET") ?? Deno.env.get("CW_AGENT_SECRET");
  if (!expected || secret !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const runOnly = body.run as string[] | undefined;

  log("starting reconciliation run", { runOnly: runOnly || "all" });

  const config = await getConfig();
  const results: Record<string, string> = {};

  try {
    if (!runOnly || runOnly.includes("bookings_to_invoices")) {
      await matchBookingsToInvoices(config); results.bookings_to_invoices = "ok";
    }
    if (!runOnly || runOnly.includes("stripe_payments")) {
      await matchStripePayments(config); results.stripe_payments = "ok";
    }
    if (!runOnly || runOnly.includes("payouts_to_deposits")) {
      await matchPayoutsToDeposits(config); results.payouts_to_deposits = "ok";
    }
    if (!runOnly || runOnly.includes("supplier_payments")) {
      await matchSupplierPayments(config); results.supplier_payments = "ok";
    }

    await supabase.from("recon_audit_log").insert({
      action: "reconciliation_run",
      source_system: "recon-engine",
      after_state: results,
    });

    log("reconciliation run complete", results);
    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log("reconciliation run failed", { error: errMsg });

    await supabase.from("recon_dead_letter_queue").insert({
      source_system: "recon-engine",
      event_type: "reconciliation_run",
      payload: body,
      error_message: errMsg,
      status: "failed",
    });

    return new Response(JSON.stringify({ success: false, error: errMsg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
