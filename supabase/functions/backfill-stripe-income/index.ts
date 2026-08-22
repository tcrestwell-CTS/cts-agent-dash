import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * backfill-stripe-income (admin-only, one-off maintenance)
 *
 * 1. Advisor subscriptions: pull every paid Stripe invoice for each linked
 *    advisor subscription customer and upsert it into
 *    public.agent_subscription_payments (agency Other Income).
 * 2. Loan repayments: pull succeeded Stripe charges for each loan applicant's
 *    email and mark matching pending loan_payment_schedules rows as paid.
 *
 * Idempotent: subscription rows key on stripe_payment_intent_id, loan rows are
 * skipped when the payment intent is already recorded.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[backfill-stripe-income] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

const toDate = (unix?: number | null) =>
  unix ? new Date(unix * 1000).toISOString().slice(0, 10) : null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── auth: admin / office_admin / bookkeeper only ──────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Missing authorization" }, 401);
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData.user) return respond({ error: "Unauthorized" }, 401);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r: { role: string }) =>
      ["admin", "office_admin", "bookkeeper"].includes(r.role)
    );
    if (!allowed) return respond({ error: "Forbidden" }, 403);

    const dryRun = new URL(req.url).searchParams.get("dry_run") === "true";
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    /** Stripe processing fee for an invoice (charge or payment intent based). */
    const feeForInvoice = async (inv: any) => {
      let chargeId = typeof inv.charge === "string" ? inv.charge : inv.charge?.id ?? null;
      if (!chargeId) {
        const piId = typeof inv.payment_intent === "string"
          ? inv.payment_intent
          : inv.payment_intent?.id ?? null;
        if (piId) {
          try {
            const pi = await stripe.paymentIntents.retrieve(piId) as any;
            chargeId = typeof pi.latest_charge === "string"
              ? pi.latest_charge
              : pi.latest_charge?.id ?? null;
          } catch { /* ignore */ }
        }
      }
      return await feeFor(chargeId);
    };

    const feeFor = async (chargeId?: string | null) => {
      if (!chargeId) return 0;
      try {
        const charge = await stripe.charges.retrieve(chargeId, {
          expand: ["balance_transaction"],
        }) as any;
        const bt = charge.balance_transaction;
        return bt && typeof bt !== "string" && bt.fee != null ? bt.fee / 100 : 0;
      } catch {
        return 0;
      }
    };

    // ── 1. Advisor subscription invoices ─────────────────────────────────
    const { data: subs } = await supabase
      .from("agent_subscriptions")
      .select("id, agent_user_id, plan_name, stripe_customer_id, stripe_subscription_id");

    const subscriptionRows: Record<string, unknown>[] = [];
    for (const sub of subs ?? []) {
      if (!sub.stripe_customer_id) continue;
      const invoices = await stripe.invoices.list({
        customer: sub.stripe_customer_id,
        status: "paid",
        limit: 100,
      });
      for (const inv of invoices.data as any[]) {
        const amount = (inv.amount_paid ?? 0) / 100;
        if (amount <= 0) continue;
        const line = inv.lines?.data?.[0];
        const pi = typeof inv.payment_intent === "string"
          ? inv.payment_intent
          : inv.payment_intent?.id ?? `invoice:${inv.id}`;
        subscriptionRows.push({
          agent_user_id: sub.agent_user_id,
          plan_name: sub.plan_name ?? line?.description ?? null,
          amount,
          stripe_fee: await feeForInvoice(inv),
          payment_date: toDate(inv.status_transitions?.paid_at ?? inv.created),
          period_start: toDate(line?.period?.start),
          period_end: toDate(line?.period?.end),
          payment_method: "stripe",
          status: "paid",
          stripe_payment_intent_id: pi,
          stripe_subscription_id: inv.parent?.subscription_details?.subscription ??
            inv.subscription ?? sub.stripe_subscription_id,
          notes: "Backfilled from Stripe invoices",
        });
      }
    }

    if (subscriptionRows.length && !dryRun) {
      const { error } = await supabase
        .from("agent_subscription_payments")
        .upsert(subscriptionRows, {
          onConflict: "stripe_payment_intent_id",
        });
      if (error) {
        log("Subscription upsert failed", { message: error.message, details: error.details, hint: error.hint, code: error.code });
        throw new Error(`Subscription upsert failed: ${error.message}`);
      }
    }
    log("Subscription invoices", { count: subscriptionRows.length });

    // ── 2. Loan repayments (paid Stripe "Loan" subscription invoices) ────
    const { data: loans } = await supabase
      .from("loan_applications")
      .select("id, email, first_name, last_name, status");

    const { data: schedules } = await supabase
      .from("loan_payment_schedules")
      .select("id, loan_application_id, payment_number, total_payment, status, stripe_payment_intent_id")
      .order("payment_number");

    const knownPis = new Set(
      (schedules ?? []).map((s: any) => s.stripe_payment_intent_id).filter(Boolean),
    );

    const loanUpdates: {
      id: string;
      loan: string;
      payment_number: number;
      pi: string;
      date: string | null;
      amount: number;
    }[] = [];

    // Collect every paid invoice (paginate) whose line description mentions a loan.
    const loanInvoices: any[] = [];
    let starting_after: string | undefined;
    for (let page = 0; page < 10; page++) {
      const batch = await stripe.invoices.list({
        status: "paid",
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      });
      for (const inv of batch.data as any[]) {
        const desc = inv.lines?.data?.[0]?.description ?? "";
        if (/loan/i.test(desc)) loanInvoices.push(inv);
      }
      if (!batch.has_more) break;
      starting_after = batch.data[batch.data.length - 1]?.id;
    }
    loanInvoices.sort((a, b) => (a.created ?? 0) - (b.created ?? 0));

    // Months already recorded as paid per loan, to avoid double-logging.
    const { data: paidRows } = await supabase
      .from("loan_payment_schedules")
      .select("loan_application_id, paid_date")
      .eq("status", "paid");
    const paidMonths: Record<string, string[]> = {};
    for (const r of paidRows ?? []) {
      if (!r.paid_date) continue;
      const key = r.loan_application_id as string;
      (paidMonths[key] ??= []).push(String(r.paid_date).slice(0, 7));
    }

    for (const inv of loanInvoices) {
      const email = (inv.customer_email ?? "").toLowerCase();
      const loan = (loans ?? []).find((l: any) => (l.email ?? "").toLowerCase() === email);
      if (!loan) {
        log("No loan application matched for invoice", { invoice: inv.id });
        continue;
      }
      const pi = typeof inv.payment_intent === "string"
        ? inv.payment_intent
        : inv.payment_intent?.id ?? `invoice:${inv.id}`;
      if (knownPis.has(pi)) continue;
      // Skip when a payment for that same month is already recorded (older
      // rows were logged against the charge id, not the invoice id).
      const paidDate = toDate(inv.status_transitions?.paid_at ?? inv.created);
      const month = paidDate?.slice(0, 7);
      if (month && (paidMonths[loan.id] ?? []).includes(month)) {
        log("Month already paid — skipping invoice", { invoice: inv.id, month });
        continue;
      }
      if (month) (paidMonths[loan.id] ??= []).push(month);

      const gross = (inv.amount_paid ?? 0) / 100;
      const target = (schedules ?? []).find((s: any) =>
        s.loan_application_id === loan.id &&
        s.status !== "paid" &&
        Math.abs(Number(s.total_payment) - gross) <= 0.02 &&
        !loanUpdates.some((u) => u.id === s.id)
      );
      if (!target) continue;
      loanUpdates.push({
        id: target.id,
        loan: `${loan.first_name} ${loan.last_name}`,
        payment_number: target.payment_number,
        pi,
        date: paidDate,
        amount: gross,
      });
      knownPis.add(pi);
    }


    if (!dryRun) {
      for (const u of loanUpdates) {
        const { error } = await supabase
          .from("loan_payment_schedules")
          .update({
            status: "paid",
            paid_date: u.date,
            stripe_payment_intent_id: u.pi,
          })
          .eq("id", u.id);
        if (error) log("Loan update failed", { id: u.id, message: error.message });
      }
    }
    log("Loan repayments matched", { count: loanUpdates.length });

    return respond({
      dry_run: dryRun,
      subscription_invoices: subscriptionRows.length,
      subscription_total: subscriptionRows.reduce(
        (s, r) => s + Number(r.amount ?? 0),
        0,
      ),
      loan_payments_marked_paid: loanUpdates.length,
      loan_details: loanUpdates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return respond({ error: message }, 500);
  }
});
