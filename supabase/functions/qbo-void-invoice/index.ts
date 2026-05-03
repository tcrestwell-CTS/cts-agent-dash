// Voids a QBO Invoice and any payments linked to it. Admin-only.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";

async function getValidToken() {
  const { data: conn } = await supabase
    .from("qbo_connections")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!conn) throw new Error("No active QBO connection");
  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    const credentials = btoa(
      `${Deno.env.get("QBO_CLIENT_ID")}:${Deno.env.get("QBO_CLIENT_SECRET")}`,
    );
    const resp = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(conn.refresh_token)}`,
      },
    );
    const r = await resp.json();
    await supabase.from("qbo_connections").update({
      access_token: r.access_token,
      refresh_token: r.refresh_token,
      token_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(),
    }).eq("id", conn.id);
    return { accessToken: r.access_token, realmId: conn.realm_id };
  }
  return { accessToken: conn.access_token, realmId: conn.realm_id };
}

async function qboGet(token: string, realm: string, path: string) {
  const url = `${QBO_BASE}/${realm}/${path}${path.includes("?") ? "&" : "?"}minorversion=65`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`QBO GET ${path}: ${d?.Fault?.Error?.[0]?.Message || r.status}`);
  return d;
}

async function qboPost(token: string, realm: string, path: string, body: unknown) {
  const url = `${QBO_BASE}/${realm}/${path}${path.includes("?") ? "&" : "?"}minorversion=65`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) {
    const f = d?.Fault?.Error?.[0];
    throw new Error(`QBO POST ${path}: ${f?.Message || r.status} — ${f?.Detail || ""}`);
  }
  return d;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles || []).some((r: any) => ["admin", "office_admin"].includes(r.role));
  if (!isAdmin) return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* */ }
  const qboInvoiceId = String(body.qbo_invoice_id || "");
  if (!qboInvoiceId) return new Response(JSON.stringify({ error: "qbo_invoice_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { accessToken, realmId } = await getValidToken();
  const results: any = { paymentsVoided: [], invoiceVoided: false };

  // 1. Find linked payments
  const inv = await qboGet(accessToken, realmId, `invoice/${qboInvoiceId}`);
  const linked: any[] = inv?.Invoice?.LinkedTxn || [];
  const paymentIds = linked.filter((l) => l.TxnType === "Payment").map((l) => l.TxnId);

  // 2. Void each payment
  for (const pid of paymentIds) {
    try {
      const p = await qboGet(accessToken, realmId, `payment/${pid}`);
      const sync = p?.Payment?.SyncToken;
      const voided = await qboPost(accessToken, realmId, `payment?operation=void`, {
        Id: pid,
        SyncToken: sync,
        sparse: true,
      });
      results.paymentsVoided.push({ id: pid, status: voided?.Payment?.PrivateNote || "voided" });
    } catch (err) {
      results.paymentsVoided.push({ id: pid, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // 3. Void the invoice
  try {
    const fresh = await qboGet(accessToken, realmId, `invoice/${qboInvoiceId}`);
    const sync = fresh?.Invoice?.SyncToken;
    await qboPost(accessToken, realmId, `invoice?operation=void`, {
      Id: qboInvoiceId,
      SyncToken: sync,
      sparse: true,
    });
    results.invoiceVoided = true;
  } catch (err) {
    results.invoiceError = err instanceof Error ? err.message : String(err);
  }

  // 4. Local cache cleanup
  await supabase.from("qbo_invoices").update({
    status: "Voided",
    balance: 0,
    synced_at: new Date().toISOString(),
  }).eq("qbo_id", qboInvoiceId);

  const { data: mapping } = await supabase
    .from("qbo_invoice_mappings")
    .select("invoice_id")
    .eq("qbo_invoice_id", qboInvoiceId)
    .maybeSingle();
  if (mapping?.invoice_id) {
    await supabase.from("invoices").update({
      status: "cancelled",
      amount_paid: 0,
      amount_remaining: 0,
    }).eq("id", mapping.invoice_id);
  }

  await supabase.from("recon_audit_log").insert({
    actor_id: user.id,
    actor_email: user.email || "",
    action: "qbo_void_invoice",
    record_type: "qbo_invoice",
    record_id: qboInvoiceId,
    after_state: results,
    qbo_object_id: qboInvoiceId,
  });

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});