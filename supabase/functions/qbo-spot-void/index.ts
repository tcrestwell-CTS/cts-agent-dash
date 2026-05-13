import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * One-shot: void a single duplicate QBO Payment and upsert the surviving
 * payment into qbo_payments cache for the given crm_payment_id.
 *
 * POST body:
 * {
 *   crm_payment_id: string,    // trip_payments.id
 *   keep_qbo_id: string,       // QBO Payment Id to retain (older)
 *   void_qbo_ids: string[],    // QBO Payment Ids to void
 *   dry_run?: boolean
 * }
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

  try {
    const body = await req.json();
    const { crm_payment_id, keep_qbo_id, void_qbo_ids, dry_run } = body || {};
    if (!crm_payment_id || !keep_qbo_id || !Array.isArray(void_qbo_ids)) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: conns } = await supabase
      .from("qbo_connections").select("*").eq("is_active", true).limit(1);
    if (!conns || !conns.length) throw new Error("no active qbo connection");
    const conn = await refreshTokenIfNeeded(supabase, conns[0]);
    const qboBase = `${QBO_BASE}/${conn.realm_id}`;
    const headers = {
      Authorization: `Bearer ${conn.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // Fetch keep payment for invoice linkage + customer
    const keepResp = await fetch(`${qboBase}/payment/${keep_qbo_id}`, { headers });
    if (!keepResp.ok) throw new Error(`fetch keep failed: ${keepResp.status} ${await keepResp.text()}`);
    const keepJson = await keepResp.json();
    const keep = keepJson?.Payment;
    const keepInvoice = keep?.Line?.[0]?.LinkedTxn?.[0]?.TxnId || null;
    const keepCustomer = keep?.CustomerRef?.value || null;
    const keepAmount = keep?.TotalAmt;
    const keepDate = keep?.TxnDate;
    const keepSyncToken = keep?.SyncToken;

    const voided: any[] = [];
    for (const vid of void_qbo_ids) {
      if (dry_run) { voided.push({ vid, dry_run: true }); continue; }
      const f = await fetch(`${qboBase}/payment/${vid}`, { headers });
      if (!f.ok) { voided.push({ vid, error: `fetch ${f.status}` }); continue; }
      const fj = await f.json();
      const st = fj?.Payment?.SyncToken;
      // Try delete first (works for unlinked payments). Fall back to void if needed.
      const del = await fetch(`${qboBase}/payment?operation=delete`, {
        method: "POST", headers,
        body: JSON.stringify({ Id: vid, SyncToken: st }),
      });
      const dt = await del.text();
      let result: any = { vid, op: "delete", status: del.status, ok: del.ok, body: dt.substring(0, 300) };
      if (!del.ok) {
        const v = await fetch(`${qboBase}/payment?operation=void`, {
          method: "POST", headers,
          body: JSON.stringify({ Id: vid, SyncToken: st }),
        });
        const vt = await v.text();
        result = { vid, op: "void_fallback", status: v.status, ok: v.ok, body: vt.substring(0, 300), delete_err: dt.substring(0, 200) };
      }
      voided.push(result);
      await new Promise(r => setTimeout(r, 600));
    }

    let cache: any = { skipped: true };
    if (!dry_run) {
      const { data, error } = await supabase.from("qbo_payments").upsert({
        qbo_id: keep_qbo_id,
        qbo_customer_id: keepCustomer,
        qbo_invoice_id: keepInvoice,
        crm_payment_id,
        total_amt: keepAmount,
        txn_date: keepDate,
        sync_token: keepSyncToken,
        trigger_managed: true,
        synced_at: new Date().toISOString(),
        raw_payload: keep,
      }, { onConflict: "qbo_id" }).select();
      cache = error ? { error: error.message } : { ok: true, row: data };
    }

    return new Response(JSON.stringify({
      ok: true, dry_run: !!dry_run,
      keep: { qbo_id: keep_qbo_id, invoice: keepInvoice, customer: keepCustomer, amount: keepAmount, date: keepDate },
      voided, cache,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});