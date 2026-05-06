import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

/**
 * Auto-match Stripe PaymentIntents to manually-logged trip_payments rows
 * by exact amount and a date window (default ±7 days).
 *
 * Scope: agency-wide (all trips). Requires an authenticated admin/office_admin
 * caller (we trust the caller's role check in the database).
 *
 * Behavior:
 *  - Pulls succeeded Stripe PaymentIntents from the last `lookback_days` (default 90).
 *  - Skips PIs whose id is already on a trip_payments row.
 *  - For each remaining PI, finds trip_payments rows with:
 *      stripe_payment_intent_id IS NULL
 *      status = 'paid'
 *      amount * 100 == PI.amount (cents-equal)
 *      payment_date within ±window_days of PI.created
 *  - If exactly ONE candidate: auto-link (writes stripe_payment_intent_id +
 *    stripe_receipt_url when available).
 *  - If multiple candidates: returns as `ambiguous` for manual review.
 *  - If zero candidates: returns as `unmatched_in_stripe` (no manual row found).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

    // ── Auth: validate JWT and confirm caller is admin/office_admin ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roleRows || []).some((r: any) => r.role === "admin" || r.role === "office_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin or office_admin required" }), { status: 403, headers: corsHeaders });
    }

    // ── Parse params ──
    let body: any = {};
    try { body = req.method === "POST" ? await req.json() : {}; } catch { body = {}; }
    const lookbackDays = Math.max(1, Math.min(180, Number(body.lookback_days) || 90));
    const windowDays = Math.max(0, Math.min(60, Number(body.window_days) ?? 7));
    const dryRun = Boolean(body.dry_run);

    // ── 1. Pull Stripe succeeded PaymentIntents in window ──
    const sinceUnix = Math.floor((Date.now() - lookbackDays * 86400000) / 1000);
    const allPIs: any[] = [];
    let startingAfter: string | null = null;
    for (let page = 0; page < 10; page++) {
      const url = new URL("https://api.stripe.com/v1/payment_intents");
      url.searchParams.set("limit", "100");
      url.searchParams.set("created[gte]", String(sinceUnix));
      if (startingAfter) url.searchParams.set("starting_after", startingAfter);
      const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Stripe API error: ${r.status} ${t}`);
      }
      const j = await r.json();
      const pis = (j.data || []).filter((pi: any) => pi.status === "succeeded");
      allPIs.push(...pis);
      if (!j.has_more || (j.data || []).length === 0) break;
      startingAfter = j.data[j.data.length - 1].id;
    }

    // ── 2. Pull existing PI ids already linked, to skip ──
    const piIds = allPIs.map((p) => p.id);
    const { data: alreadyLinked } = await admin
      .from("trip_payments")
      .select("stripe_payment_intent_id")
      .in("stripe_payment_intent_id", piIds.length > 0 ? piIds : ["__none__"]);
    const linkedSet = new Set((alreadyLinked || []).map((r: any) => r.stripe_payment_intent_id).filter(Boolean));

    // ── 3. Pull candidate manual trip_payments (status paid, no PI id) ──
    const sinceIso = new Date((sinceUnix - windowDays * 86400) * 1000).toISOString().split("T")[0];
    const { data: candidates } = await admin
      .from("trip_payments")
      .select("id, trip_id, amount, status, payment_date, payment_method, stripe_payment_intent_id, details, notes")
      .is("stripe_payment_intent_id", null)
      .eq("status", "paid")
      .gte("payment_date", sinceIso);

    const allCandidates = candidates || [];

    // ── 4. Walk PIs, find unique amount+date matches ──
    const linked: any[] = [];
    const ambiguous: any[] = [];
    const unmatched: any[] = [];
    const usedCandidateIds = new Set<string>();

    for (const pi of allPIs) {
      if (linkedSet.has(pi.id)) continue;
      const piCents = pi.amount;
      const piCreated = pi.created * 1000;
      const lo = piCreated - windowDays * 86400000;
      const hi = piCreated + windowDays * 86400000;

      const matches = allCandidates.filter((c) => {
        if (usedCandidateIds.has(c.id)) return false;
        const cents = Math.round(Number(c.amount) * 100);
        if (cents !== piCents) return false;
        if (!c.payment_date) return false;
        const t = new Date(c.payment_date + "T12:00:00").getTime();
        return t >= lo && t <= hi;
      });

      const piSummary = {
        pi_id: pi.id,
        amount: pi.amount / 100,
        currency: pi.currency,
        created: new Date(pi.created * 1000).toISOString(),
        receipt_email: pi.receipt_email,
        customer: pi.customer,
      };

      if (matches.length === 0) {
        unmatched.push(piSummary);
        continue;
      }

      if (matches.length > 1) {
        ambiguous.push({
          ...piSummary,
          candidate_count: matches.length,
          candidates: matches.map((m) => ({
            payment_id: m.id,
            trip_id: m.trip_id,
            amount: Number(m.amount),
            payment_date: m.payment_date,
            payment_method: m.payment_method,
            details: m.details,
          })),
        });
        continue;
      }

      // Exactly one match — link it.
      const match = matches[0];
      usedCandidateIds.add(match.id);

      // Try to grab a receipt URL from the latest charge.
      let receiptUrl: string | null = null;
      const latestChargeId = pi.latest_charge as string | undefined;
      if (latestChargeId) {
        try {
          const cr = await fetch(`https://api.stripe.com/v1/charges/${latestChargeId}`, {
            headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
          });
          if (cr.ok) {
            const cj = await cr.json();
            receiptUrl = cj.receipt_url || null;
          }
        } catch {/* ignore */}
      }

      if (!dryRun) {
        const update: Record<string, any> = {
          stripe_payment_intent_id: pi.id,
        };
        if (receiptUrl) update.stripe_receipt_url = receiptUrl;
        // Tag method as 'stripe' if not set
        if (!match.payment_method) update.payment_method = "stripe";
        const { error: upErr } = await admin
          .from("trip_payments")
          .update(update)
          .eq("id", match.id);
        if (upErr) {
          unmatched.push({ ...piSummary, error: `link failed: ${upErr.message}` });
          continue;
        }
      }

      linked.push({
        ...piSummary,
        payment_id: match.id,
        trip_id: match.trip_id,
        local_amount: Number(match.amount),
        local_payment_date: match.payment_date,
        receipt_url: receiptUrl,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: dryRun,
        params: { lookback_days: lookbackDays, window_days: windowDays },
        summary: {
          stripe_pis_scanned: allPIs.length,
          already_linked: linkedSet.size,
          candidates_considered: allCandidates.length,
          newly_linked: linked.length,
          ambiguous: ambiguous.length,
          unmatched_in_stripe: unmatched.length,
        },
        linked,
        ambiguous,
        unmatched_in_stripe: unmatched,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("stripe-auto-match error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String((err as Error)?.message || err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});