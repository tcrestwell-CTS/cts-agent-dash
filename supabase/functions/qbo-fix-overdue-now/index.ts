// One-shot: posts full-balance QBO Payments for a hardcoded list of
// qbo_invoice ids. Internal use only — gated by x-internal-secret header
// matching CW_AGENT_SECRET. No user auth required.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
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
        body: `grant_type=refresh_token&refresh_token=${
          encodeURIComponent(conn.refresh_token)
        }`,
      },
    );
    const r = await resp.json();
    await supabase.from("qbo_connections").update({
      access_token: r.access_token,
      refresh_token: r.refresh_token,
      token_expires_at: new Date(Date.now() + r.expires_in * 1000)
        .toISOString(),
    }).eq("id", conn.id);
    return { accessToken: r.access_token, realmId: conn.realm_id };
  }
  return { accessToken: conn.access_token, realmId: conn.realm_id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== Deno.env.get("CW_AGENT_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.qbo_invoice_ids)
    ? body.qbo_invoice_ids.map(String)
    : [];
  if (!ids.length) {
    return new Response(JSON.stringify({ error: "qbo_invoice_ids required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
      JSON.stringify({ error: "No deposit account configured" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { accessToken, realmId } = await getValidToken();
  const txnDate = new Date().toISOString().slice(0, 10);
  const results: any[] = [];

  for (const qboInvoiceId of ids) {
    try {
      const invResp = await fetch(
        `${QBO_BASE}/${realmId}/invoice/${qboInvoiceId}?minorversion=65`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );
      const invJson = await invResp.json();
      if (!invResp.ok) {
        throw new Error(
          `GET invoice failed: ${
            invJson?.Fault?.Error?.[0]?.Message || invResp.status
          }`,
        );
      }
      const invoice = invJson.Invoice;
      const balance = Number(invoice?.Balance || 0);
      const customerRef = invoice?.CustomerRef?.value;
      if (!customerRef) throw new Error("Invoice missing CustomerRef");
      if (balance <= 0) {
        results.push({ qboInvoiceId, skipped: true, reason: "zero_balance" });
        continue;
      }
      const payResp = await fetch(
        `${QBO_BASE}/${realmId}/payment?minorversion=65`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            CustomerRef: { value: customerRef },
            TotalAmt: balance,
            TxnDate: txnDate,
            DepositToAccountRef: { value: String(depositAccountId) },
            PrivateNote:
              "Fix overdue: invoice already paid in CRM (one-shot reconciliation)",
            Line: [
              {
                Amount: balance,
                LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: "Invoice" }],
              },
            ],
          }),
        },
      );
      const payJson = await payResp.json();
      if (!payResp.ok) {
        const f = payJson?.Fault?.Error?.[0];
        throw new Error(
          `Payment create failed: ${f?.Message || payResp.status} — ${
            f?.Detail || ""
          }`,
        );
      }
      const paymentId = payJson.Payment?.Id;
      await supabase.from("qbo_invoices").update({
        balance: 0,
        status: "Paid",
        synced_at: new Date().toISOString(),
      }).eq("qbo_id", qboInvoiceId);
      results.push({
        qboInvoiceId,
        success: true,
        paymentId,
        amount: balance,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ qboInvoiceId, success: false, error: msg });
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});