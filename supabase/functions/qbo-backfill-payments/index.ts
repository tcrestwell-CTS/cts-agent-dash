import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Sequentially backfill QBO client payments for a set of trip_payments.
 *
 * POST body:
 *   {
 *     parent_trip_id?: string,   // sync all paid payments under this group
 *     trip_id?: string,          // single trip
 *     payment_ids?: string[],    // explicit ids
 *     delay_ms?: number,         // default 1500ms between calls
 *     max_retries?: number       // default 5
 *   }
 *
 * Returns per-payment results with retry/backoff for 429 and Stale Object (5010).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }

  const delayMs = Number(body.delay_ms ?? 1500);
  const maxRetries = Number(body.max_retries ?? 5);

  // ── Resolve target trip_payments ──
  let payments: any[] = [];

  if (Array.isArray(body.payment_ids) && body.payment_ids.length > 0) {
    const { data, error } = await supabase
      .from("trip_payments")
      .select("id, trip_id, status")
      .in("id", body.payment_ids);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    payments = data || [];
  } else {
    let tripIds: string[] = [];
    if (body.parent_trip_id) {
      const { data: subs } = await supabase
        .from("trips")
        .select("id")
        .or(`id.eq.${body.parent_trip_id},parent_trip_id.eq.${body.parent_trip_id}`);
      tripIds = (subs || []).map((t: any) => t.id);
    } else if (body.trip_id) {
      tripIds = [body.trip_id];
    } else {
      return new Response(
        JSON.stringify({ error: "Provide parent_trip_id, trip_id, or payment_ids" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (tripIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, results: [], skipped: "no trips" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tps, error: tpErr } = await supabase
      .from("trip_payments")
      .select("id, trip_id, status, payment_date")
      .in("trip_id", tripIds)
      .eq("status", "paid")
      .order("payment_date", { ascending: true });
    if (tpErr) {
      return new Response(JSON.stringify({ error: tpErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    payments = tps || [];
  }

  // Filter out already-synced
  if (payments.length > 0) {
    const ids = payments.map((p) => p.id);
    const { data: existing } = await supabase
      .from("qbo_payments")
      .select("crm_payment_id")
      .in("crm_payment_id", ids);
    const synced = new Set((existing || []).map((e: any) => e.crm_payment_id));
    payments = payments.filter((p) => !synced.has(p.id));
  }

  const triggerUrl = `${SUPABASE_URL}/functions/v1/qbo-sync-trigger`;
  const results: any[] = [];

  for (const p of payments) {
    // Re-fetch full payment record
    const { data: full } = await supabase
      .from("trip_payments")
      .select("*")
      .eq("id", p.id)
      .single();

    if (!full) {
      results.push({ payment_id: p.id, status: "skipped", reason: "not found" });
      continue;
    }

    let attempt = 0;
    let success = false;
    let lastError: string | null = null;

    while (attempt <= maxRetries && !success) {
      attempt++;
      try {
        const resp = await fetch(triggerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            trigger_type: "client_payment_received",
            record: full,
          }),
        });

        const text = await resp.text();

        if (resp.ok) {
          success = true;
          results.push({ payment_id: p.id, attempts: attempt, status: "synced" });
          break;
        }

        lastError = text;
        const isRateLimit = resp.status === 429 || /Too Many|throttle/i.test(text);
        const isStale = /Stale Object|"5010"/i.test(text);

        if (isRateLimit || isStale) {
          // Exponential backoff with jitter
          const wait = Math.min(15000, 1500 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 500);
          await sleep(wait);
          continue;
        }

        // Non-retryable
        results.push({
          payment_id: p.id,
          attempts: attempt,
          status: "failed",
          error: text.substring(0, 500),
        });
        break;
      } catch (err: any) {
        lastError = err?.message || String(err);
        await sleep(2000);
      }
    }

    if (!success && !results.find((r) => r.payment_id === p.id)) {
      results.push({
        payment_id: p.id,
        attempts: attempt,
        status: "failed",
        error: (lastError || "max retries exceeded").substring(0, 500),
      });
    }

    // Pace requests between payments
    await sleep(delayMs);
  }

  const summary = {
    total: payments.length,
    synced: results.filter((r) => r.status === "synced").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
  };

  return new Response(JSON.stringify({ ok: true, summary, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
