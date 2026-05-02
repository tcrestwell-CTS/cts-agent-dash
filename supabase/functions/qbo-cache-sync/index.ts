// supabase/functions/qbo-cache-sync/index.ts
// Pulls QBO objects into local cache tables for matching without live API calls
// Can be triggered manually or on a schedule
// NEVER modifies QBO — read only

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";
const log = (step: string, data?: unknown) =>
  console.log(`[qbo-cache-sync] ${step}`, data ? JSON.stringify(data) : "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getValidToken(): Promise<{ accessToken: string; realmId: string }> {
  const { data: conn, error } = await supabase
    .from("qbo_connections")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !conn) throw new Error("No active QBO connection found");

  const expiresAt = new Date(conn.token_expires_at).getTime();
  const now = Date.now();
  const fiveMin = 5 * 60 * 1000;

  if (expiresAt - now < fiveMin) {
    log("refreshing QBO token");
    const refreshed = await refreshToken(conn.refresh_token);
    await supabase
      .from("qbo_connections")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("id", conn.id);
    return { accessToken: refreshed.access_token, realmId: conn.realm_id };
  }

  return { accessToken: conn.access_token, realmId: conn.realm_id };
}

async function refreshToken(refreshToken: string) {
  const clientId = Deno.env.get("QBO_CLIENT_ID")!;
  const clientSecret = Deno.env.get("QBO_CLIENT_SECRET")!;
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const resp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });

  if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status}`);
  return resp.json();
}

async function qboQuery(accessToken: string, realmId: string, query: string): Promise<unknown[]> {
  const url = `${QBO_BASE}/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (resp.status === 429) {
    log("rate limited by QBO — waiting 10s");
    await new Promise((r) => setTimeout(r, 10000));
    return qboQuery(accessToken, realmId, query);
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`QBO query failed ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const queryResponse = data.QueryResponse;
  if (!queryResponse) return [];
  const entities = Object.values(queryResponse).find(Array.isArray);
  return (entities as unknown[]) || [];
}

async function syncAccounts(token: string, realmId: string) {
  log("syncing accounts");
  const items = await qboQuery(token, realmId,
    "SELECT * FROM Account WHERE Active = true MAXRESULTS 1000"
  ) as Array<Record<string, unknown>>;

  for (const item of items) {
    await supabase.from("qbo_accounts").upsert({
      qbo_id: item.Id as string,
      name: item.Name,
      account_type: item.AccountType,
      account_sub_type: item.AccountSubType,
      active: item.Active,
      raw_payload: item,
      synced_at: new Date().toISOString(),
    }, { onConflict: "qbo_id" });
  }
  log(`synced ${items.length} accounts`);
}

async function syncCustomers(token: string, realmId: string) {
  log("syncing customers");
  const items = await qboQuery(token, realmId,
    "SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000"
  ) as Array<Record<string, unknown>>;

  for (const item of items) {
    const email = (item.PrimaryEmailAddr as Record<string, string>)?.Address || null;
    const displayName = item.DisplayName as string;

    let crmClientId = null;
    if (email) {
      const { data: client } = await supabase.from("clients").select("id").eq("email", email).maybeSingle();
      if (client) crmClientId = client.id;
    }

    await supabase.from("qbo_customers").upsert({
      qbo_id: item.Id as string,
      display_name: displayName,
      email,
      crm_client_id: crmClientId,
      sync_token: item.SyncToken,
      active: item.Active,
      raw_payload: item,
      synced_at: new Date().toISOString(),
    }, { onConflict: "qbo_id" });

    if (crmClientId) {
      await supabase.from("recon_entity_mappings").upsert({
        mapping_type: "crm_client_to_qbo_customer",
        crm_id: crmClientId,
        qbo_id: item.Id as string,
        verified: true,
      }, { onConflict: "mapping_type,crm_id,qbo_id" });
    }
  }
  log(`synced ${items.length} customers`);
}

async function syncVendors(token: string, realmId: string) {
  log("syncing vendors");
  const items = await qboQuery(token, realmId,
    "SELECT * FROM Vendor WHERE Active = true MAXRESULTS 1000"
  ) as Array<Record<string, unknown>>;

  for (const item of items) {
    const email = (item.PrimaryEmailAddr as Record<string, string>)?.Address || null;
    await supabase.from("qbo_vendors").upsert({
      qbo_id: item.Id as string,
      display_name: item.DisplayName,
      email,
      sync_token: item.SyncToken,
      active: item.Active,
      raw_payload: item,
      synced_at: new Date().toISOString(),
    }, { onConflict: "qbo_id" });
  }
  log(`synced ${items.length} vendors`);
}

async function syncInvoices(token: string, realmId: string) {
  log("syncing invoices");
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const items = await qboQuery(token, realmId,
    `SELECT * FROM Invoice WHERE MetaData.LastUpdatedTime >= '${since}' MAXRESULTS 1000`
  ) as Array<Record<string, unknown>>;

  for (const item of items) {
    const docNumber = item.DocNumber as string;
    let crmBookingId = null;
    if (docNumber) {
      const { data: booking } = await supabase.from("bookings").select("id").eq("confirmation_number", docNumber).maybeSingle();
      if (booking) crmBookingId = booking.id;
    }

    await supabase.from("qbo_invoices").upsert({
      qbo_id: item.Id as string,
      qbo_customer_id: (item.CustomerRef as Record<string, string>)?.value,
      crm_booking_id: crmBookingId,
      doc_number: docNumber,
      total_amt: parseFloat(item.TotalAmt as string),
      balance: parseFloat(item.Balance as string),
      due_date: (item.DueDate as string) || null,
      txn_date: item.TxnDate as string,
      status: parseFloat(item.Balance as string) === 0 ? "Paid" : "Open",
      trigger_managed: true,
      sync_token: item.SyncToken,
      raw_payload: item,
      synced_at: new Date().toISOString(),
    }, { onConflict: "qbo_id" });
  }
  log(`synced ${items.length} invoices`);
}

async function syncPayments(token: string, realmId: string) {
  log("syncing payments");
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const items = await qboQuery(token, realmId,
    `SELECT * FROM Payment WHERE MetaData.LastUpdatedTime >= '${since}' MAXRESULTS 1000`
  ) as Array<Record<string, unknown>>;

  for (const item of items) {
    await supabase.from("qbo_payments").upsert({
      qbo_id: item.Id as string,
      qbo_customer_id: (item.CustomerRef as Record<string, string>)?.value,
      total_amt: parseFloat(item.TotalAmt as string),
      txn_date: item.TxnDate as string,
      payment_ref_num: item.PaymentRefNum || null,
      trigger_managed: true,
      sync_token: item.SyncToken,
      raw_payload: item,
      synced_at: new Date().toISOString(),
    }, { onConflict: "qbo_id" });
  }
  log(`synced ${items.length} payments`);
}

async function syncDeposits(token: string, realmId: string) {
  log("syncing deposits");
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const items = await qboQuery(token, realmId,
    `SELECT * FROM Deposit WHERE MetaData.LastUpdatedTime >= '${since}' MAXRESULTS 1000`
  ) as Array<Record<string, unknown>>;

  for (const item of items) {
    await supabase.from("qbo_deposits").upsert({
      qbo_id: item.Id as string,
      deposit_to_account_id: (item.DepositToAccountRef as Record<string, string>)?.value || null,
      total_amt: parseFloat(item.TotalAmt as string),
      txn_date: item.TxnDate as string,
      memo: item.PrivateNote || null,
      trigger_managed: true,
      sync_token: item.SyncToken,
      raw_payload: item,
      synced_at: new Date().toISOString(),
    }, { onConflict: "qbo_id" });
  }
  log(`synced ${items.length} deposits`);
}

async function syncBills(token: string, realmId: string) {
  log("syncing bills");
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const items = await qboQuery(token, realmId,
    `SELECT * FROM Bill WHERE MetaData.LastUpdatedTime >= '${since}' MAXRESULTS 1000`
  ) as Array<Record<string, unknown>>;

  for (const item of items) {
    await supabase.from("qbo_bills").upsert({
      qbo_id: item.Id as string,
      qbo_vendor_id: (item.VendorRef as Record<string, string>)?.value,
      doc_number: item.DocNumber || null,
      total_amt: parseFloat(item.TotalAmt as string),
      balance: parseFloat(item.Balance as string),
      due_date: (item.DueDate as string) || null,
      txn_date: item.TxnDate as string,
      status: parseFloat(item.Balance as string) === 0 ? "Paid" : "Open",
      trigger_managed: true,
      sync_token: item.SyncToken,
      raw_payload: item,
      synced_at: new Date().toISOString(),
    }, { onConflict: "qbo_id" });
  }
  log(`synced ${items.length} bills`);
}

async function syncBillPayments(token: string, realmId: string) {
  log("syncing bill payments");
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const items = await qboQuery(token, realmId,
    `SELECT * FROM BillPayment WHERE MetaData.LastUpdatedTime >= '${since}' MAXRESULTS 1000`
  ) as Array<Record<string, unknown>>;

  for (const item of items) {
    await supabase.from("qbo_bill_payments").upsert({
      qbo_id: item.Id as string,
      qbo_vendor_id: (item.VendorRef as Record<string, string>)?.value,
      total_amt: parseFloat(item.TotalAmt as string),
      txn_date: item.TxnDate as string,
      payment_ref_num: item.DocNumber || null,
      trigger_managed: true,
      sync_token: item.SyncToken,
      raw_payload: item,
      synced_at: new Date().toISOString(),
    }, { onConflict: "qbo_id" });
  }
  log(`synced ${items.length} bill payments`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Authenticate: accept either an admin user JWT or the agent secret (for cron)
  const secret = req.headers.get("x-agent-secret");
  const expected = Deno.env.get("AGENT_SECRET") ?? Deno.env.get("CW_AGENT_SECRET");
  const hasValidSecret = expected && secret === expected;

  if (!hasValidSecret) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r: { role: string }) =>
      r.role === "admin" || r.role === "office_admin"
    );
    if (!isAdmin) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
  }

  const body = await req.json().catch(() => ({}));
  const objects = body.objects as string[] | undefined;
  const syncAll = !objects || objects.length === 0;

  log("starting sync", { objects: objects || "all" });
  const results: Record<string, string> = {};

  try {
    const { accessToken, realmId } = await getValidToken();

    if (syncAll || objects?.includes("accounts")) { await syncAccounts(accessToken, realmId); results.accounts = "ok"; }
    if (syncAll || objects?.includes("customers")) { await syncCustomers(accessToken, realmId); results.customers = "ok"; }
    if (syncAll || objects?.includes("vendors")) { await syncVendors(accessToken, realmId); results.vendors = "ok"; }
    if (syncAll || objects?.includes("invoices")) { await syncInvoices(accessToken, realmId); results.invoices = "ok"; }
    if (syncAll || objects?.includes("payments")) { await syncPayments(accessToken, realmId); results.payments = "ok"; }
    if (syncAll || objects?.includes("deposits")) { await syncDeposits(accessToken, realmId); results.deposits = "ok"; }
    if (syncAll || objects?.includes("bills")) { await syncBills(accessToken, realmId); results.bills = "ok"; }
    if (syncAll || objects?.includes("bill_payments")) { await syncBillPayments(accessToken, realmId); results.bill_payments = "ok"; }

    await supabase.from("recon_audit_log").insert({
      action: "qbo_cache_sync",
      source_system: "qbo",
      after_state: results,
    });

    log("sync complete", results);
    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log("sync failed", { error: errMsg });

    await supabase.from("recon_dead_letter_queue").insert({
      source_system: "qbo",
      event_type: "cache_sync",
      payload: { objects },
      error_message: errMsg,
      status: "failed",
    });

    return new Response(JSON.stringify({ success: false, error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
