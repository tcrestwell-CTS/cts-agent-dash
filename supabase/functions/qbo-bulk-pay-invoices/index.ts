// Bulk-applies full-balance Payments in QuickBooks Online to a list of qbo_invoices.
// Admin-only. Posts one Payment per invoice for the remaining balance, dated today,
// depositing to the configured recon bank account.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";
const log = (s: string, d?: unknown) =>
  console.log(`[qbo-bulk-pay-invoices] ${s}`, d ? JSON.stringify(d) : "");

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
        body: `grant_type=refresh_token&refresh_token=${
          encodeURIComponent(conn.refresh_token)
        }`,
      },
    );
    const r = await resp.json();
    await supabase
      .from("qbo_connections")
      .update({
        access_token: r.access_token,
        refresh_token: r.refresh_token,
        token_expires_at: new Date(Date.now() + r.expires_in * 1000)
          .toISOString(),
      })
      .eq("id", conn.id);
    return { accessToken: r.access_token, realmId: conn.realm_id };
  }
  return { accessToken: conn.access_token, realmId: conn.realm_id };
}

async function qboGet(
  accessToken: string,
  realmId: string,
  path: string,
) {
  const url = `${QBO_BASE}/${realmId}/${path}${
    path.includes("?") ? "&" : "?"
  }minorversion=65`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(
      `QBO GET ${path} failed: ${data?.Fault?.Error?.[0]?.Message || resp.status}`,
    );
  }
  return data;
}

async function qboCreate(
  accessToken: string,
  realmId: string,
  entity: string,
  payload: Record<string, unknown>,
) {
  const url = `${QBO_BASE}/${realmId}/${entity}?minorversion=65`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const fault = data?.Fault?.Error?.[0];
    throw new Error(
      `QBO ${entity} create failed: ${fault?.Message || resp.status} — ${
        fault?.Detail || ""
      }`,
    );
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const auth = req.headers.get("Authorization");
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Admin gate
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles || []).some((r: any) =>
    ["admin", "office_admin"].includes(r.role)
  );
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_) { /* */ }

  const qboInvoiceIds: string[] = Array.isArray(body.qbo_invoice_ids)
    ? body.qbo_invoice_ids.map(String)
    : [];
  if (qboInvoiceIds.length === 0) {
    return new Response(
      JSON.stringify({ error: "qbo_invoice_ids required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { data: cfg } = await supabase
    .from("recon_account_config")
    .select("*")
    .eq("company_id", "crestwell")
    .single();
  const depositAccountId = cfg?.qbo_bank_account_id ||
    cfg?.undeposited_funds_account_id;
  if (!depositAccountId) {
    return new Response(
      JSON.stringify({ error: "No deposit account configured in Recon Settings" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { accessToken, realmId } = await getValidToken();
  const txnDate = new Date().toISOString().slice(0, 10);
  const results: any[] = [];

  for (const qboInvoiceId of qboInvoiceIds) {
    try {
      // Fetch fresh invoice from QBO to get accurate Balance + CustomerRef
      const inv = await qboGet(
        accessToken,
        realmId,
        `invoice/${qboInvoiceId}`,
      );
      const invoice = inv.Invoice;
      const balance = Number(invoice?.Balance || 0);
      const customerRef = invoice?.CustomerRef?.value;
      if (!customerRef) throw new Error("Invoice missing CustomerRef");
      if (balance <= 0) {
        results.push({ qboInvoiceId, skipped: true, reason: "zero_balance" });
        continue;
      }

      const payload = {
        CustomerRef: { value: customerRef },
        TotalAmt: balance,
        TxnDate: txnDate,
        DepositToAccountRef: { value: String(depositAccountId) },
        PrivateNote: `Bulk pay (Alaska/NCL) by ${user.email}`,
        Line: [
          {
            Amount: balance,
            LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: "Invoice" }],
          },
        ],
      };

      const result = await qboCreate(accessToken, realmId, "payment", payload);
      const payment = result.Payment;
      log("payment posted", { qboInvoiceId, paymentId: payment?.Id, balance });

      // Update local cache
      await supabase
        .from("qbo_invoices")
        .update({
          balance: 0,
          status: "Paid",
          synced_at: new Date().toISOString(),
        })
        .eq("qbo_id", qboInvoiceId);

      // Best-effort sync the local invoices.amount_paid if mapped
      const { data: mapping } = await supabase
        .from("qbo_invoice_mappings")
        .select("invoice_id")
        .eq("qbo_invoice_id", qboInvoiceId)
        .maybeSingle();
      if (mapping?.invoice_id) {
        const { data: localInv } = await supabase
          .from("invoices")
          .select("total_amount")
          .eq("id", mapping.invoice_id)
          .maybeSingle();
        if (localInv) {
          await supabase
            .from("invoices")
            .update({
              amount_paid: localInv.total_amount,
              amount_remaining: 0,
              status: "paid",
            })
            .eq("id", mapping.invoice_id);
        }
      }

      await supabase.from("recon_audit_log").insert({
        actor_id: user.id,
        actor_email: user.email || "",
        action: "qbo_bulk_pay_invoice",
        record_type: "qbo_invoice",
        record_id: qboInvoiceId,
        after_state: { paymentId: payment?.Id, amount: balance },
        qbo_object_id: payment?.Id || null,
      });

      results.push({
        qboInvoiceId,
        success: true,
        paymentId: payment?.Id,
        amount: balance,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("payment failed", { qboInvoiceId, error: msg });
      results.push({ qboInvoiceId, success: false, error: msg });
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});