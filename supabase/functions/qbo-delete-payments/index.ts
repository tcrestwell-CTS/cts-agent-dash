// Deletes specific QBO payments by ID. Admin-only.
// Used for cleaning up duplicate/incorrect payments that were created in error.
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
  const qboPaymentIds: string[] = Array.isArray(body.qbo_payment_ids) ? body.qbo_payment_ids.map(String) : [];
  if (qboPaymentIds.length === 0) {
    return new Response(JSON.stringify({ error: "qbo_payment_ids array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { accessToken, realmId } = await getValidToken();
  const results: { id: string; status: string; error?: string }[] = [];

  for (const pid of qboPaymentIds) {
    try {
      const p = await qboGet(accessToken, realmId, `payment/${pid}`);
      const sync = p?.Payment?.SyncToken;
      if (!sync) {
        results.push({ id: pid, status: "not_found" });
        continue;
      }
      // Delete the payment
      await qboPost(accessToken, realmId, `payment?operation=delete`, {
        Id: pid,
        SyncToken: sync,
      });
      // Remove from local cache
      await supabase.from("qbo_payments").delete().eq("qbo_id", pid);
      results.push({ id: pid, status: "deleted" });
    } catch (e: any) {
      results.push({ id: pid, status: "error", error: String(e?.message || e) });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});