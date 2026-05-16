import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Flagged charges from balance_history.csv (charges with empty trip_payment_id / trip_id metadata)
const FLAGGED_CHARGES = [
  "ch_3TRMs2PJljF0WNcY0UAIRp9q", // Betty Rogers   - Mamie's birthday cruise
  "ch_3TRDfKPJljF0WNcY2qvkFwGy", // Peggy Harris   - Mamie's birthday cruise
  "ch_3TR1SFPJljF0WNcY1xyP12hz", // Peggy Harris   - (no trip_name)
  "ch_3TR19aPJljF0WNcY2hYk2Ewc", // Betty Rogers   - (no trip_name)
  "ch_3TQddKPJljF0WNcY1m3Qf4O3", // Mamie Austin
  "ch_3TQdbyPJljF0WNcY2rcztTqr", // Mamie Austin
  "ch_3TOvzOPJljF0WNcY0vpWfvST", // Wellyse Anderson - Claire's 60th
  "ch_3TOSKuPJljF0WNcY2pBzmPiW", // Tabitha Mathis
  "ch_3TNOYpPJljF0WNcY1lzPBs47", // Tabitha Mathis
  "ch_3TNNOxPJljF0WNcY1j73VRsa", // Janice Lindsay - Utopia drink pkg
  "ch_3TNFBlPJljF0WNcY0heP1Pge", // Amberlee Cantrell - Alaska
  "ch_3TNBq7PJljF0WNcY0osVlHl9", // Gerri Cannon
  "ch_3TMWwwPJljF0WNcY2tLPL8W8", // Tim Crestwell - test
  "ch_3TL4GqPJljF0WNcY1Cask1D4", // Chelsea Violenes-Hill
  "ch_3TL28HPJljF0WNcY00wPd2EZ", // Whitney Anderson
  "ch_3TJyr2PJljF0WNcY1LsXIQ2x", // Wellyse Anderson
  "ch_3TJbSvPJljF0WNcY2QuOmcUl", // Donna Smith - Royal Caribbean
];

type ChargeReport = {
  charge_id: string;
  amount: number;
  created_iso: string;
  customer_email?: string | null;
  customer_name?: string | null;
  trip_name?: string | null;
  payment_intent_id?: string | null;
  // Creation-path fingerprints
  source_path: string;
  pi_metadata: Record<string, string>;
  pi_application?: string | null;       // app/connect id
  pi_client_secret_truncated?: string;
  checkout_session_id?: string | null;
  checkout_session_url?: string | null;
  payment_link_id?: string | null;
  invoice_id?: string | null;
  // Required-fields audit
  missing_trip_payment_id: boolean;
  missing_trip_id: boolean;
  missing_payment_type: boolean;
  payment_type_value?: string | null;
  notes: string[];
};

function classifyPath(opts: {
  pi: any;
  checkoutSession: any | null;
  paymentLinkId: string | null;
  invoiceId: string | null;
}): { path: string; notes: string[] } {
  const { pi, checkoutSession, paymentLinkId, invoiceId } = opts;
  const notes: string[] = [];

  if (invoiceId) {
    notes.push("PI is attached to a Stripe Invoice — likely a one-off invoice push.");
    return { path: "stripe_invoice", notes };
  }
  if (paymentLinkId) {
    notes.push(`Came from a Stripe Payment Link (${paymentLinkId}) — metadata defined at link, not per-charge.`);
    return { path: "payment_link", notes };
  }
  if (checkoutSession) {
    const ref = checkoutSession.client_reference_id;
    const sessMeta = checkoutSession.metadata ?? {};
    if (ref || sessMeta.trip_payment_id) {
      notes.push("Checkout Session has client_reference_id / trip metadata — CRM-created Checkout that failed to forward metadata to PI.");
      return { path: "crm_checkout_metadata_drop", notes };
    }
    notes.push("Checkout Session has no client_reference_id and no trip_payment_id metadata — created OUTSIDE the CRM (manual dashboard Checkout or public deposit form).");
    return { path: "external_checkout_session", notes };
  }
  if (pi.application) {
    notes.push(`PI created via Stripe app/integration (${pi.application}).`);
    return { path: "stripe_app", notes };
  }
  // Bare PI with no session
  notes.push("PI created directly without a Checkout Session — likely a custom front-end PaymentIntent (deposit form / public site) or manual dashboard charge.");
  return { path: "direct_payment_intent", notes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2025-08-27.basil",
  });

  const results: ChargeReport[] = [];
  const summary: Record<string, number> = {};

  for (const chargeId of FLAGGED_CHARGES) {
    try {
      const charge = await stripe.charges.retrieve(chargeId, {
        expand: ["payment_intent", "payment_intent.invoice"],
      });

      const pi: any =
        typeof charge.payment_intent === "object" && charge.payment_intent
          ? charge.payment_intent
          : charge.payment_intent
            ? await stripe.paymentIntents.retrieve(charge.payment_intent as string)
            : null;

      const piMeta = (pi?.metadata ?? {}) as Record<string, string>;
      const chMeta = (charge.metadata ?? {}) as Record<string, string>;
      const merged = { ...chMeta, ...piMeta };

      let checkoutSession: any = null;
      if (pi?.id) {
        const list = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        checkoutSession = list.data[0] ?? null;
      }

      const invoiceId =
        (typeof pi?.invoice === "object" ? pi?.invoice?.id : pi?.invoice) ?? null;
      const paymentLinkId = checkoutSession?.payment_link ?? null;

      const { path, notes } = classifyPath({
        pi,
        checkoutSession,
        paymentLinkId,
        invoiceId,
      });

      const report: ChargeReport = {
        charge_id: charge.id,
        amount: charge.amount / 100,
        created_iso: new Date(charge.created * 1000).toISOString(),
        customer_email: merged.customer_email ?? charge.billing_details?.email ?? null,
        customer_name: merged.customer_name ?? charge.billing_details?.name ?? null,
        trip_name: merged.trip_name ?? null,
        payment_intent_id: pi?.id ?? null,
        source_path: path,
        pi_metadata: merged,
        pi_application: pi?.application ?? null,
        checkout_session_id: checkoutSession?.id ?? null,
        checkout_session_url: checkoutSession?.url ?? null,
        payment_link_id: paymentLinkId,
        invoice_id: invoiceId,
        missing_trip_payment_id: !merged.trip_payment_id,
        missing_trip_id: !merged.trip_id,
        missing_payment_type:
          !merged.payment_type ||
          !["trip_installment", "loan_repayment"].includes(merged.payment_type),
        payment_type_value: merged.payment_type ?? null,
        notes,
      };

      results.push(report);
      summary[path] = (summary[path] ?? 0) + 1;
    } catch (err) {
      results.push({
        charge_id: chargeId,
        amount: 0,
        created_iso: "",
        source_path: "error",
        pi_metadata: {},
        missing_trip_payment_id: true,
        missing_trip_id: true,
        missing_payment_type: true,
        notes: [`fetch failed: ${(err as Error).message}`],
      });
      summary["error"] = (summary["error"] ?? 0) + 1;
    }
  }

  return new Response(
    JSON.stringify(
      {
        total: FLAGGED_CHARGES.length,
        by_source_path: summary,
        results,
      },
      null,
      2,
    ),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});