// Phase 5: Apply per-payment decisions from the QBO unmatched review dashboard.
// Supported ops:
//   - relink:  PATCH a QBO Payment to link it to an Invoice (LinkedTxn), then update qbo_payments.qbo_invoice_id locally.
//   - writeoff: DELETE the QBO Payment, then remove the local qbo_payments row.
// Admin-only. Reuses qbo_connections OAuth pattern from qbo-delete-payments.
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

type ActionItem = {
  qbo_payment_id: string;
  op: "relink" | "writeoff";
  target_qbo_invoice_id?: string | null;
};

async function relinkOne(
  token: string,
  realm: string,
  qboPaymentId: string,
  targetInvoiceId: string,
) {
  // Fetch current payment
  const p = await qboGet(token, realm, `payment/${qboPaymentId}`);
  const pay = p?.Payment;
  if (!pay?.SyncToken) throw new Error("Payment not found in QBO");
  if (Number(pay.UnappliedAmt ?? 0) <= 0 && Array.isArray(pay.Line) && pay.Line.length > 0) {
    throw new Error("Payment has no unapplied amount — already linked");
  }

  const amountToApply = Number(pay.UnappliedAmt ?? pay.TotalAmt ?? 0);
  if (amountToApply <= 0) throw new Error("Nothing to apply");

  // Verify the invoice exists and has balance
  const inv = await qboGet(token, realm, `invoice/${targetInvoiceId}`);
  const invoice = inv?.Invoice;
  if (!invoice) throw new Error(`Invoice ${targetInvoiceId} not found`);
  const balance = Number(invoice.Balance ?? 0);
  if (balance <= 0) throw new Error(`Invoice ${targetInvoiceId} has no remaining balance`);

  const applyAmt = Math.min(amountToApply, balance);

  // Sparse update: append a Line that links to the invoice
  const existingLines = Array.isArray(pay.Line) ? pay.Line : [];
  const newLine = {
    Amount: applyAmt,
    LinkedTxn: [{ TxnId: String(targetInvoiceId), TxnType: "Invoice" }],
  };

  const updated = await qboPost(token, realm, `payment`, {
    Id: pay.Id,
    SyncToken: pay.SyncToken,
    sparse: true,
    Line: [...existingLines, newLine],
  });

  // Update local cache
  await supabase
    .from("qbo_payments")
    .update({
      qbo_invoice_id: String(targetInvoiceId),
      sync_token: updated?.Payment?.SyncToken ?? pay.SyncToken,
      raw_payload: updated?.Payment ?? pay,
      synced_at: new Date().toISOString(),
    })
    .eq("qbo_id", qboPaymentId);

  return { applied: applyAmt, invoice_id: String(targetInvoiceId) };
}

async function writeoffOne(token: string, realm: string, qboPaymentId: string) {
  const p = await qboGet(token, realm, `payment/${qboPaymentId}`);
  const sync = p?.Payment?.SyncToken;
  if (!sync) {
    // Already gone in QBO — clean up local row
    await supabase.from("qbo_payments").delete().eq("qbo_id", qboPaymentId);
    return { deleted: true, note: "already absent in QBO" };
  }
  await qboPost(token, realm, `payment?operation=delete`, {
    Id: qboPaymentId,
    SyncToken: sync,
  });
  await supabase.from("qbo_payments").delete().eq("qbo_id", qboPaymentId);
  return { deleted: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const auth = req.headers.get("Authorization");
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles || []).some((r: any) => ["admin", "office_admin"].includes(r.role));
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* */ }
  const items: ActionItem[] = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return new Response(JSON.stringify({ error: "items array required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { accessToken, realmId } = await getValidToken();
  const results: any[] = [];

  for (const item of items) {
    try {
      if (item.op === "relink") {
        if (!item.target_qbo_invoice_id) throw new Error("target_qbo_invoice_id required for relink");
        const r = await relinkOne(accessToken, realmId, String(item.qbo_payment_id), String(item.target_qbo_invoice_id));
        results.push({ qbo_payment_id: item.qbo_payment_id, op: "relink", status: "ok", ...r });
      } else if (item.op === "writeoff") {
        const r = await writeoffOne(accessToken, realmId, String(item.qbo_payment_id));
        results.push({ qbo_payment_id: item.qbo_payment_id, op: "writeoff", status: "ok", ...r });
      } else {
        results.push({ qbo_payment_id: item.qbo_payment_id, status: "error", error: `Unknown op: ${item.op}` });
      }
    } catch (e: any) {
      results.push({
        qbo_payment_id: item.qbo_payment_id,
        op: item.op,
        status: "error",
        error: String(e?.message || e),
      });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});