import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * agent-billing-webhook
 *
 * Keeps public.agent_subscriptions in sync with Stripe automatically and logs
 * paid advisor subscription invoices into public.agent_subscription_payments
 * (agency "Other Income").
 *
 * Handled events:
 *  - customer.subscription.created / .updated / .deleted
 *  - invoice.paid / invoice.payment_succeeded  -> income row + status active
 *  - invoice.payment_failed                    -> status past_due
 *
 * Only subscriptions already linked to an advisor (matched by
 * stripe_subscription_id or stripe_customer_id) are touched — client loan /
 * payment-plan subscriptions are ignored.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const log = (step: string, details?: unknown) =>
  console.log(
    `[agent-billing-webhook] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`,
  );

const toDate = (unix?: number | null) =>
  unix ? new Date(unix * 1000).toISOString().slice(0, 10) : null;

const mapStatus = (s?: string | null) => {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    case "paused":
      return "paused";
    default:
      return s ?? "active";
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const webhookSecret = Deno.env.get("STRIPE_AGENT_BILLING_WEBHOOK_SECRET") ??
      Deno.env.get("STRIPE_WEBHOOK_SECRET");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const raw = await req.text();

    let event: Stripe.Event;
    if (webhookSecret) {
      const sig = req.headers.get("stripe-signature");
      if (!sig) return respond({ error: "Missing stripe-signature header" }, 400);
      try {
        event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
      } catch (err) {
        log("Signature verification failed", {
          message: err instanceof Error ? err.message : String(err),
        });
        return respond({ error: "Invalid signature" }, 400);
      }
    } else {
      log("WARNING: no webhook secret configured — rejecting request");
      return respond({ error: "Webhook secret not configured" }, 500);
    }

    log("Event received", { type: event.type, id: event.id });

    /** Find the advisor subscription row for a Stripe sub/customer pair. */
    const findRow = async (subId?: string | null, customerId?: string | null) => {
      if (subId) {
        const { data } = await supabase
          .from("agent_subscriptions")
          .select("id, agent_user_id, plan_name")
          .eq("stripe_subscription_id", subId)
          .maybeSingle();
        if (data) return data;
      }
      if (customerId) {
        const { data } = await supabase
          .from("agent_subscriptions")
          .select("id, agent_user_id, plan_name")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (data) return data;
      }
      return null;
    };

    /** Refresh card details on file from Stripe. */
    const cardFields = async (customerId?: string | null, pmId?: string | null) => {
      try {
        let paymentMethodId = pmId ?? null;
        if (!paymentMethodId && customerId) {
          const customer = await stripe.customers.retrieve(customerId) as any;
          paymentMethodId = customer?.invoice_settings?.default_payment_method ?? null;
        }
        if (!paymentMethodId) return {};
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (!pm.card) return {};
        return {
          payment_method_brand: pm.card.brand ?? null,
          payment_method_last4: pm.card.last4 ?? null,
          payment_method_exp: `${String(pm.card.exp_month).padStart(2, "0")}/${
            String(pm.card.exp_year).slice(-2)
          }`,
        };
      } catch (err) {
        log("Could not read payment method", {
          message: err instanceof Error ? err.message : String(err),
        });
        return {};
      }
    };

    // ── Subscription lifecycle ──────────────────────────────────────────
    if (event.type.startsWith("customer.subscription.")) {
      const sub = event.data.object as any;
      const row = await findRow(sub.id, sub.customer);
      if (!row) {
        log("No advisor subscription linked — ignoring", { sub: sub.id });
        return respond({ received: true, ignored: true });
      }

      const item = sub.items?.data?.[0];
      const periodEnd = item?.current_period_end ?? sub.current_period_end ?? null;

      const update: Record<string, unknown> = {
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer,
        status: event.type === "customer.subscription.deleted"
          ? "cancelled"
          : mapStatus(sub.status),
        next_billing_date: toDate(periodEnd),
        ...(await cardFields(sub.customer, sub.default_payment_method)),
      };

      if (item?.price?.unit_amount != null) {
        update.amount = item.price.unit_amount / 100;
        const interval = item.price.recurring?.interval;
        if (interval) update.billing_interval = interval === "year" ? "yearly" : "monthly";
        if (item.price.nickname) update.plan_name = item.price.nickname;
      }

      const { error } = await supabase
        .from("agent_subscriptions")
        .update(update)
        .eq("id", row.id);
      if (error) throw error;

      log("Subscription synced", { id: row.id, status: update.status });
      return respond({ received: true, synced: true });
    }

    // ── Invoice paid → log agency income ────────────────────────────────
    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as any;
      const subId = invoice.subscription ??
        invoice.parent?.subscription_details?.subscription ?? null;
      const row = await findRow(subId, invoice.customer);
      if (!row) {
        log("Invoice not for an advisor subscription — ignoring", { invoice: invoice.id });
        return respond({ received: true, ignored: true });
      }

      const amount = (invoice.amount_paid ?? 0) / 100;
      const line = invoice.lines?.data?.[0];
      const paymentIntentId = typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent?.id ?? `invoice:${invoice.id}`;

      // Stripe processing fee, when the balance transaction is available.
      let stripeFee = 0;
      try {
        const chargeId = typeof invoice.charge === "string" ? invoice.charge : invoice.charge?.id;
        if (chargeId) {
          const charge = await stripe.charges.retrieve(chargeId, {
            expand: ["balance_transaction"],
          }) as any;
          const bt = charge.balance_transaction;
          if (bt && typeof bt !== "string" && bt.fee != null) stripeFee = bt.fee / 100;
        }
      } catch (err) {
        log("Could not read Stripe fee", {
          message: err instanceof Error ? err.message : String(err),
        });
      }

      if (amount > 0) {
        const { error: insErr } = await supabase
          .from("agent_subscription_payments")
          .upsert({
            agent_user_id: row.agent_user_id,
            plan_name: row.plan_name ?? line?.description ?? null,
            amount,
            stripe_fee: stripeFee,
            payment_date: toDate(invoice.status_transitions?.paid_at ?? invoice.created),
            period_start: toDate(line?.period?.start),
            period_end: toDate(line?.period?.end),
            payment_method: "stripe",
            status: "paid",
            stripe_payment_intent_id: paymentIntentId,
            stripe_subscription_id: subId,
            notes: "Auto-logged from Stripe webhook",
          }, { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true });
        if (insErr) log("Income insert failed", { message: insErr.message });
        else log("Income logged", { amount, fee: stripeFee });
      }

      await supabase
        .from("agent_subscriptions")
        .update({
          status: "active",
          next_billing_date: toDate(line?.period?.end),
        })
        .eq("id", row.id);

      return respond({ received: true, logged: true });
    }

    // ── Invoice failed → mark past due ──────────────────────────────────
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as any;
      const subId = invoice.subscription ??
        invoice.parent?.subscription_details?.subscription ?? null;
      const row = await findRow(subId, invoice.customer);
      if (!row) return respond({ received: true, ignored: true });

      await supabase
        .from("agent_subscriptions")
        .update({ status: "past_due" })
        .eq("id", row.id);
      log("Marked past_due", { id: row.id });
      return respond({ received: true, past_due: true });
    }

    return respond({ received: true, unhandled: event.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return respond({ error: message }, 500);
  }
});
