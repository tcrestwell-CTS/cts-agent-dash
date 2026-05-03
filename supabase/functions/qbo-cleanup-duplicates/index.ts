import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Cleanup duplicate QBO Payments created by accidental re-runs of
 * qbo-sync-trigger for the same crm payment_id.
 *
 * Strategy: For each crm payment_id with N>1 successful sync logs,
 * keep the LATEST QBO Payment Id (most recent log) and VOID the older ones.
 * Then insert a row into qbo_payments tracking the surviving payment so
 * future backfill calls dedupe properly.
 *
 * POST body:
 *   { parent_trip_id?: string, dry_run?: boolean }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";

async function refreshTokenIfNeeded(supabase: any, conn: any) {
  if (new Date(conn.token_expires_at).getTime() > Date.now() + 60_000) return conn;
  const clientId = Deno.env.get("QBO_CLIENT_ID")!;
  const clientSecret = Deno.env.get("QBO_CLIENT_SECRET")!;
  const auth = btoa(`${clientId}:${clientSecret}`);
  const r = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: `grant_type=refresh_token&refresh_token=${conn.refresh_token}`,
  });
  if (!r.ok) throw new Error(`token refresh failed: ${await r.text()}`);
  const j = await r.json();
  const updated = {
    ...conn,
    access_token: j.access_token,
    refresh_token: j.refresh_token || conn.refresh_token,
    token_expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
  };
  await supabase.from("qbo_connections").update({
    access_token: updated.access_token,
    refresh_token: updated.refresh_token,
    token_expires_at: updated.token_expires_at,
  }).eq("id", conn.id);
  return updated;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch {}
  const dryRun = body.dry_run === true;

  // Build trip filter
  let tripFilter = "";
  let tripIds: string[] = [];
  if (body.parent_trip_id) {
    const { data: trips } = await supabase
      .from("trips").select("id")
      .or(`id.eq.${body.parent_trip_id},parent_trip_id.eq.${body.parent_trip_id}`);
    tripIds = (trips || []).map((t: any) => t.id);
  }

  // Find duplicate logs (same crm payment_id, sync_type, success)
  const { data: logs } = await supabase
    .from("qbo_sync_logs")
    .select("id, user_id, details, created_at")
    .eq("sync_type", "auto-client-payment-received")
    .eq("status", "success")
    .order("created_at", { ascending: false });

  const byCrm = new Map<string, any[]>();
  for (const lg of logs || []) {
    const cp = lg.details?.payment_id;
    const tripId = lg.details?.trip_id;
    if (!cp || !lg.details?.qbo_payment_id) continue;
    if (tripIds.length > 0 && !tripIds.includes(tripId)) continue;
    if (!byCrm.has(cp)) byCrm.set(cp, []);
    byCrm.get(cp)!.push(lg);
  }

  const results: any[] = [];

  // Group by user
  const userIds = new Set<string>();
  for (const arr of byCrm.values()) for (const l of arr) userIds.add(l.user_id);

  const tokenByUser = new Map<string, any>();
  for (const uid of userIds) {
    const { data: conn } = await supabase
      .from("qbo_connections").select("*")
      .eq("user_id", uid).eq("is_active", true).single();
    if (conn) {
      const refreshed = await refreshTokenIfNeeded(supabase, conn);
      tokenByUser.set(uid, refreshed);
    }
  }

  for (const [crmPmt, arr] of byCrm.entries()) {
    // arr already sorted DESC by created_at — keep first, void the rest
    const keep = arr[0];
    const dupes = arr.slice(1);
    const conn = tokenByUser.get(keep.user_id);
    if (!conn) {
      results.push({ crm_pmt: crmPmt, status: "skipped", reason: "no qbo connection" });
      continue;
    }
    const qboBase = `${QBO_BASE}/${conn.realm_id}`;
    const headers = {
      Authorization: `Bearer ${conn.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const voided: any[] = [];
    for (const d of dupes) {
      const qid = d.details?.qbo_payment_id;
      if (!qid) continue;
      if (dryRun) { voided.push({ qid, dryRun: true }); continue; }

      // Fetch current SyncToken
      const fetchResp = await fetch(`${qboBase}/payment/${qid}`, { headers });
      if (!fetchResp.ok) {
        voided.push({ qid, error: `fetch ${fetchResp.status}` });
        continue;
      }
      const fetched = await fetchResp.json();
      const syncToken = fetched?.Payment?.SyncToken;

      // Void via POST ?operation=void
      const v = await fetch(`${qboBase}/payment?operation=void`, {
        method: "POST",
        headers,
        body: JSON.stringify({ Id: qid, SyncToken: syncToken }),
      });
      voided.push({ qid, status: v.status, ok: v.ok });
      if (!v.ok) {
        const errTxt = await v.text();
        voided[voided.length - 1].error = errTxt.substring(0, 200);
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    // Track surviving payment in qbo_payments (qbo_id is unique)
    if (!dryRun) {
      await supabase.from("qbo_payments").upsert({
        qbo_id: keep.details.qbo_payment_id,
        qbo_customer_id: keep.details.qbo_customer_id,
        qbo_invoice_id: keep.details.qbo_invoice_id,
        crm_payment_id: crmPmt,
        total_amt: keep.details.amount,
        txn_date: new Date(keep.created_at).toISOString().split("T")[0],
        trigger_managed: true,
        synced_at: keep.created_at,
      }, { onConflict: "qbo_id" });
    }

    results.push({
      crm_pmt: crmPmt,
      kept: keep.details.qbo_payment_id,
      voided,
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    dry_run: dryRun,
    total_groups: results.length,
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
