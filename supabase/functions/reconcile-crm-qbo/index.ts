// CRM <-> QBO Reconciliation Report (read-only).
// Produces 4 CSVs uploaded to the `recon-reports/<runId>/` storage bucket:
//   summary.csv, opening_balances.csv, installments.csv, payments.csv
//
// Auth: admin / office_admin only.
// Body (optional): { client_ids?: string[], dry_run?: boolean }
//
// CRM is the source of truth. We pull QBO live via the QBO API
// (auth pattern reused from qbo-payment-action / qbo-restructure-installments)
// and report any divergence — including drift in the local qbo_* mirror tables.

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
const MINOR_VERSION = "65";

// Throttle: QBO limit is 500 req/min/realm. Stay well under.
const QBO_MIN_INTERVAL_MS = 180; // ~330 req/min
let lastQboCallAt = 0;
async function throttle() {
  const wait = QBO_MIN_INTERVAL_MS - (Date.now() - lastQboCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastQboCallAt = Date.now();
}

// ---------- QBO auth ----------
async function getQboToken() {
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
    const r = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(
          conn.refresh_token,
        )}`,
      },
    );
    const j = await r.json();
    if (!r.ok) throw new Error(`QBO token refresh failed: ${JSON.stringify(j)}`);
    await supabase
      .from("qbo_connections")
      .update({
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        token_expires_at: new Date(
          Date.now() + j.expires_in * 1000,
        ).toISOString(),
      })
      .eq("id", conn.id);
    return { token: j.access_token, realm: conn.realm_id };
  }
  return { token: conn.access_token, realm: conn.realm_id };
}

async function qboGet(token: string, realm: string, path: string) {
  await throttle();
  const url = `${QBO_BASE}/${realm}/${path}${
    path.includes("?") ? "&" : "?"
  }minorversion=${MINOR_VERSION}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await r.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* */ }
  if (!r.ok) {
    const msg = data?.Fault?.Error?.[0]?.Message || `HTTP ${r.status}`;
    const err: any = new Error(`QBO GET ${path}: ${msg}`);
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function qboQuery(token: string, realm: string, sql: string) {
  const path = `query?query=${encodeURIComponent(sql)}`;
  return qboGet(token, realm, path);
}

// Safe wrapper — returns null on 404 / not found
async function qboGetOrNull(token: string, realm: string, path: string) {
  try {
    return await qboGet(token, realm, path);
  } catch (e: any) {
    if (e.status === 404 || /not found|object not found/i.test(String(e.message))) {
      return null;
    }
    throw e;
  }
}

// ---------- helpers ----------
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const moneyEq = (a: number, b: number) => Math.abs((a || 0) - (b || 0)) <= 0.01;
const daysBetween = (a?: string | null, b?: string | null) => {
  if (!a || !b) return null;
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((da - db) / 86400000);
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(csvEscape).join(",");
  const body = rows
    .map((r) => columns.map((c) => csvEscape(r[c])).join(","))
    .join("\n");
  return header + "\n" + body + (body ? "\n" : "");
}

async function uploadCsv(runId: string, name: string, csv: string) {
  const path = `${runId}/${name}`;
  const { error } = await supabase.storage
    .from("recon-reports")
    .upload(path, new Blob([csv], { type: "text/csv" }), {
      upsert: true,
      contentType: "text/csv",
    });
  if (error) throw new Error(`Upload ${name} failed: ${error.message}`);
  return path;
}

async function logProgress(runId: string, message: string, details: any = {}) {
  await supabase.from("qbo_sync_logs").insert({
    sync_type: "recon-report",
    direction: "read",
    status: "info",
    records_processed: 0,
    error_message: null,
    details: { run_id: runId, message, ...details },
  });
}

// ---------- main ----------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: admin or office_admin
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
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles || []).some((r: any) =>
    ["admin", "office_admin"].includes(r.role),
  );
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const filterClientIds: string[] | null = Array.isArray(body?.client_ids) && body.client_ids.length
    ? body.client_ids.map(String)
    : null;

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  try {
    const { token, realm } = await getQboToken();
    await logProgress(runId, "started", { client_filter: filterClientIds });

    // ------------ Load CRM-side data ------------
    let clientsQ = supabase
      .from("clients")
      .select("id, name, user_id, status");
    if (filterClientIds) clientsQ = clientsQ.in("id", filterClientIds);
    const { data: clients, error: clientsErr } = await clientsQ;
    if (clientsErr) throw clientsErr;

    // qbo_customers map: crm_client_id -> qbo_id
    const { data: qboCust } = await supabase
      .from("qbo_customers")
      .select("crm_client_id, qbo_id, display_name");
    const crmToQboCustomer = new Map<string, { qbo_id: string; display_name: string | null }>();
    for (const c of qboCust || []) {
      if (c.crm_client_id) crmToQboCustomer.set(c.crm_client_id, { qbo_id: c.qbo_id, display_name: c.display_name });
    }

    const clientById = new Map<string, any>();
    for (const c of clients || []) clientById.set(c.id, c);

    // CRM Invoices (trip installments)
    let invQ = supabase
      .from("invoices")
      .select("id, user_id, trip_id, client_id, invoice_number, invoice_date, total_amount, amount_paid, amount_remaining, status, created_at");
    if (filterClientIds) invQ = invQ.in("client_id", filterClientIds);
    const { data: crmInvoices } = await invQ;

    // QBO mappings (invoice_id -> qbo_invoice_id)
    const invIds = (crmInvoices || []).map((i: any) => i.id);
    const invMap = new Map<string, string>();
    if (invIds.length) {
      // chunk to avoid URL limits
      for (let i = 0; i < invIds.length; i += 500) {
        const slice = invIds.slice(i, i + 500);
        const { data } = await supabase
          .from("qbo_invoice_mappings")
          .select("invoice_id, qbo_invoice_id")
          .in("invoice_id", slice);
        for (const m of data || []) invMap.set(m.invoice_id, m.qbo_invoice_id);
      }
    }

    // Loan installments
    let lpsQ = supabase
      .from("loan_payment_schedules")
      .select("id, loan_application_id, payment_number, due_date, total_payment, status, paid_date, qbo_invoice_id, loan_applications!inner(client_id)");
    if (filterClientIds) lpsQ = lpsQ.in("loan_applications.client_id", filterClientIds);
    const { data: loanScheds } = await lpsQ as any;

    // CRM Trip payments (paid)
    let tpQ = supabase
      .from("trip_payments")
      .select("id, trip_id, amount, payment_date, payment_method, status, stripe_payment_intent_id, trips!inner(client_id)")
      .eq("status", "paid");
    if (filterClientIds) tpQ = tpQ.in("trips.client_id", filterClientIds);
    const { data: tripPayments } = await tpQ as any;

    // qbo_payments mirror
    const tripPayIds = (tripPayments || []).map((p: any) => p.id);
    const qboPayByCrm = new Map<string, any>();
    if (tripPayIds.length) {
      for (let i = 0; i < tripPayIds.length; i += 500) {
        const slice = tripPayIds.slice(i, i + 500);
        const { data } = await supabase
          .from("qbo_payments")
          .select("*")
          .in("crm_payment_id", slice);
        for (const p of data || []) qboPayByCrm.set(p.crm_payment_id, p);
      }
    }

    // ------------ Diff #1: Opening balances ------------
    const openingRows: any[] = [];
    const customerCache = new Map<string, any>();
    for (const c of clients || []) {
      const qbo = crmToQboCustomer.get(c.id);
      // CRM opening balance: no marker column exists -> treat as $0
      const crmOpening = 0;
      let qboOpening = 0;
      let status = "match";
      if (!qbo) {
        if (filterClientIds || (c.status === "active")) {
          status = "missing_in_qbo";
        } else {
          continue; // skip non-active leads with no QBO record
        }
      } else {
        const liveCust = await qboGetOrNull(token, realm, `customer/${qbo.qbo_id}`);
        if (liveCust?.Customer) {
          customerCache.set(qbo.qbo_id, liveCust.Customer);
          qboOpening = Number(liveCust.Customer.OpenBalance ?? 0);
        } else {
          status = "missing_in_qbo";
        }
      }
      const variance = round2(crmOpening - qboOpening);
      if (status === "match" && !moneyEq(crmOpening, qboOpening)) status = "mismatch";
      // Only emit row if there's something interesting OR a mismatch
      if (status !== "match" || qboOpening !== 0) {
        openingRows.push({
          client_id: c.id,
          client_name: c.name,
          qbo_customer_id: qbo?.qbo_id ?? "",
          crm_opening_balance: crmOpening,
          qbo_opening_balance: qboOpening,
          variance,
          status,
        });
      }
    }
    await logProgress(runId, "opening_balances done", { rows: openingRows.length });

    // ------------ Diff #2: Installments ------------
    const installRows: any[] = [];
    const liveInvoiceCache = new Map<string, any>();

    async function fetchLiveInvoice(qboId: string) {
      if (liveInvoiceCache.has(qboId)) return liveInvoiceCache.get(qboId);
      const r = await qboGetOrNull(token, realm, `invoice/${qboId}`);
      const inv = r?.Invoice ?? null;
      liveInvoiceCache.set(qboId, inv);
      return inv;
    }

    // Trip installments (from invoices)
    for (const inv of crmInvoices || []) {
      const qboId = invMap.get(inv.id);
      const client = clientById.get(inv.client_id);
      const live = qboId ? await fetchLiveInvoice(qboId) : null;
      const m: any = {
        source: "trip",
        crm_schedule_id: inv.id,
        client_name: client?.name ?? inv.client_id,
        parent_id: inv.trip_id,
        installment_number: (inv.invoice_number?.match(/-(\d+)$/)?.[1]) || "1",
        crm_due_date: inv.invoice_date,
        qbo_due_date: live?.DueDate ?? null,
        crm_amount: Number(inv.total_amount || 0),
        qbo_amount: live ? Number(live.TotalAmt || 0) : null,
        crm_status: inv.status,
        qbo_status: live ? (Number(live.Balance) <= 0.01 ? "paid" : "open") : null,
        qbo_invoice_id: qboId ?? "",
        qbo_balance: live ? Number(live.Balance || 0) : null,
        variance_amount: 0,
        variance_days: null,
        mismatch_type: "",
      };
      const types: string[] = [];
      if (!qboId) types.push("missing_in_qbo_mapping");
      else if (!live) types.push("qbo_invoice_deleted");
      else {
        if (!moneyEq(m.crm_amount, m.qbo_amount)) types.push("amount_mismatch");
        const dd = daysBetween(m.crm_due_date, m.qbo_due_date);
        m.variance_days = dd;
        if (dd !== null && dd !== 0) types.push("date_mismatch");
        const crmPaid = Number(inv.amount_remaining) <= 0.01;
        const qboPaid = Number(live.Balance) <= 0.01;
        if (crmPaid && !qboPaid) types.push("crm_paid_qbo_open");
        if (!crmPaid && qboPaid) types.push("qbo_paid_crm_open");
      }
      m.variance_amount = round2((m.crm_amount || 0) - (m.qbo_amount || 0));
      m.mismatch_type = types.join("|") || "match";
      if (m.mismatch_type !== "match") installRows.push(m);
    }

    // Loan installments
    for (const lps of loanScheds || []) {
      const clientId = lps.loan_applications?.client_id;
      const client = clientId ? clientById.get(clientId) : null;
      const qboId = lps.qbo_invoice_id;
      const live = qboId ? await fetchLiveInvoice(qboId) : null;
      const m: any = {
        source: "loan",
        crm_schedule_id: lps.id,
        client_name: client?.name ?? clientId ?? "",
        parent_id: lps.loan_application_id,
        installment_number: lps.payment_number,
        crm_due_date: lps.due_date,
        qbo_due_date: live?.DueDate ?? null,
        crm_amount: Number(lps.total_payment || 0),
        qbo_amount: live ? Number(live.TotalAmt || 0) : null,
        crm_status: lps.status,
        qbo_status: live ? (Number(live.Balance) <= 0.01 ? "paid" : "open") : null,
        qbo_invoice_id: qboId ?? "",
        qbo_balance: live ? Number(live.Balance || 0) : null,
        variance_amount: 0,
        variance_days: null,
        mismatch_type: "",
      };
      const types: string[] = [];
      if (!qboId) types.push("missing_in_qbo_mapping");
      else if (!live) types.push("qbo_invoice_deleted");
      else {
        if (!moneyEq(m.crm_amount, m.qbo_amount)) types.push("amount_mismatch");
        const dd = daysBetween(m.crm_due_date, m.qbo_due_date);
        m.variance_days = dd;
        if (dd !== null && dd !== 0) types.push("date_mismatch");
        const crmPaid = !!lps.paid_date;
        const qboPaid = Number(live.Balance) <= 0.01;
        if (crmPaid && !qboPaid) types.push("crm_paid_qbo_open");
        if (!crmPaid && qboPaid) types.push("qbo_paid_crm_open");
      }
      m.variance_amount = round2((m.crm_amount || 0) - (m.qbo_amount || 0));
      m.mismatch_type = types.join("|") || "match";
      if (m.mismatch_type !== "match") installRows.push(m);
    }
    await logProgress(runId, "installments done", { rows: installRows.length });

    // ------------ Diff #3: Payments ------------
    const payRows: any[] = [];
    const seenQboPayIds = new Set<string>();

    for (const tp of tripPayments || []) {
      const clientId = tp.trips?.client_id;
      const client = clientId ? clientById.get(clientId) : null;
      const mirror = qboPayByCrm.get(tp.id);
      let live: any = null;
      if (mirror?.qbo_id) {
        const r = await qboGetOrNull(token, realm, `payment/${mirror.qbo_id}`);
        live = r?.Payment ?? null;
        if (live) seenQboPayIds.add(String(live.Id));
      }
      const types: string[] = [];
      if (!mirror) types.push("missing_in_qbo");
      else if (!live) types.push("qbo_payment_deleted_mirror_drift");
      else {
        if (!moneyEq(Number(tp.amount), Number(live.TotalAmt))) types.push("amount_mismatch");
        const dd = daysBetween(tp.payment_date, live.TxnDate);
        if (dd !== null && dd !== 0) types.push("date_mismatch");
        const linked = Array.isArray(live.Line)
          ? live.Line.flatMap((l: any) => l.LinkedTxn || [])
          : [];
        if (linked.length === 0 || Number(live.UnappliedAmt || 0) > 0.01) {
          types.push("unapplied_in_qbo");
        }
        if (!mirror.qbo_invoice_id && linked.length > 0) {
          types.push("mirror_missing_invoice_link");
        }
      }
      const row: any = {
        source: "trip_payment",
        crm_payment_id: tp.id,
        qbo_payment_id: mirror?.qbo_id ?? "",
        client_name: client?.name ?? clientId ?? "",
        parent_id: tp.trip_id,
        payment_date: tp.payment_date,
        crm_amount: Number(tp.amount || 0),
        qbo_amount: live ? Number(live.TotalAmt || 0) : (mirror ? Number(mirror.total_amt || 0) : null),
        crm_payment_method: tp.payment_method,
        qbo_deposit_account: live?.DepositToAccountRef?.value ?? null,
        expected_deposit_account: tp.payment_method === "stripe" || tp.stripe_payment_intent_id ? "stripe_clearing" : "trip_deposit",
        account_mismatch: "", // computed below if accounts mapping is configured
        qbo_invoice_id_linked: live
          ? (Array.isArray(live.Line)
              ? live.Line.flatMap((l: any) => (l.LinkedTxn || []).map((t: any) => t.TxnId)).join("|")
              : "")
          : (mirror?.qbo_invoice_id ?? ""),
        stripe_ref: tp.stripe_payment_intent_id ?? "",
        variance_amount: 0,
        variance_days: live ? daysBetween(tp.payment_date, live.TxnDate) : null,
        mismatch_type: "",
      };
      row.variance_amount = round2((row.crm_amount || 0) - (row.qbo_amount || 0));
      row.mismatch_type = types.join("|") || "match";
      if (row.mismatch_type !== "match") payRows.push(row);
    }

    // Detect QBO orphan payments per customer (payments in QBO with no CRM source)
    for (const c of clients || []) {
      const qbo = crmToQboCustomer.get(c.id);
      if (!qbo) continue;
      const q = await qboQuery(
        token,
        realm,
        `select Id, TotalAmt, TxnDate, UnappliedAmt, DepositToAccountRef, Line from Payment where CustomerRef = '${qbo.qbo_id}' MAXRESULTS 1000`,
      );
      const list = q?.QueryResponse?.Payment ?? [];
      for (const p of list) {
        if (seenQboPayIds.has(String(p.Id))) continue;
        // Could legitimately be a loan/non-trip payment — flag as orphan and let reviewer judge
        const types = ["orphan_in_qbo"];
        const linked = Array.isArray(p.Line)
          ? p.Line.flatMap((l: any) => l.LinkedTxn || [])
          : [];
        if (linked.length === 0 || Number(p.UnappliedAmt || 0) > 0.01) {
          types.push("unapplied_in_qbo");
        }
        payRows.push({
          source: "qbo_only",
          crm_payment_id: "",
          qbo_payment_id: String(p.Id),
          client_name: c.name,
          parent_id: "",
          payment_date: p.TxnDate,
          crm_amount: null,
          qbo_amount: Number(p.TotalAmt || 0),
          crm_payment_method: "",
          qbo_deposit_account: p.DepositToAccountRef?.value ?? null,
          expected_deposit_account: "",
          account_mismatch: "",
          qbo_invoice_id_linked: linked.map((l: any) => l.TxnId).join("|"),
          stripe_ref: "",
          variance_amount: round2(0 - Number(p.TotalAmt || 0)),
          variance_days: 0,
          mismatch_type: types.join("|"),
        });
      }
    }
    await logProgress(runId, "payments done", { rows: payRows.length });

    // ------------ Summary ------------
    const summarize = (rows: any[], dim: string, totalCrm: number, totalQbo: number) => {
      const mismatched = rows.filter((r) => r.mismatch_type !== "match" && r.status !== "match").length || rows.length;
      const missingQbo = rows.filter((r) =>
        (r.mismatch_type ?? "").includes("missing_in_qbo") ||
        (r.status === "missing_in_qbo")
      ).length;
      const missingCrm = rows.filter((r) =>
        (r.mismatch_type ?? "").includes("orphan_in_qbo") ||
        (r.status === "missing_in_crm")
      ).length;
      const totalVar = rows.reduce((s, r) => s + Math.abs(Number(r.variance ?? r.variance_amount ?? 0)), 0);
      return {
        dimension: dim,
        total_crm_records: totalCrm,
        total_qbo_records: totalQbo,
        matched: Math.max(0, totalCrm - mismatched),
        mismatched,
        missing_in_qbo: missingQbo,
        missing_in_crm: missingCrm,
        total_variance_dollars: round2(totalVar),
      };
    };

    const summaryRows = [
      summarize(openingRows, "opening_balances", clients?.length || 0, customerCache.size),
      summarize(installRows, "installments", (crmInvoices?.length || 0) + (loanScheds?.length || 0), liveInvoiceCache.size),
      summarize(payRows, "payments", tripPayments?.length || 0, seenQboPayIds.size),
    ];

    // ------------ CSVs ------------
    const csvSummary = toCsv(summaryRows, [
      "dimension","total_crm_records","total_qbo_records","matched","mismatched","missing_in_qbo","missing_in_crm","total_variance_dollars",
    ]);
    const csvOpening = toCsv(openingRows, [
      "client_id","client_name","qbo_customer_id","crm_opening_balance","qbo_opening_balance","variance","status",
    ]);
    const csvInstall = toCsv(installRows, [
      "source","crm_schedule_id","client_name","parent_id","installment_number","crm_due_date","qbo_due_date","crm_amount","qbo_amount","crm_status","qbo_status","qbo_invoice_id","qbo_balance","variance_amount","variance_days","mismatch_type",
    ]);
    const csvPay = toCsv(payRows, [
      "source","crm_payment_id","qbo_payment_id","client_name","parent_id","payment_date","crm_amount","qbo_amount","crm_payment_method","qbo_deposit_account","expected_deposit_account","account_mismatch","qbo_invoice_id_linked","stripe_ref","variance_amount","variance_days","mismatch_type",
    ]);

    const completedAt = new Date().toISOString();
    let files: Record<string, string> = {};
    if (!body?.dry_run) {
      const [s, o, i, p] = await Promise.all([
        uploadCsv(runId, "summary.csv", csvSummary),
        uploadCsv(runId, "opening_balances.csv", csvOpening),
        uploadCsv(runId, "installments.csv", csvInstall),
        uploadCsv(runId, "payments.csv", csvPay),
      ]);
      files = { summary: s, opening_balances: o, installments: i, payments: p };
    }
    await logProgress(runId, "completed", { files });

    return new Response(
      JSON.stringify({
        report_run_id: runId,
        started_at: startedAt,
        completed_at: completedAt,
        summary: {
          opening_balances: {
            checked: clients?.length || 0,
            mismatches: openingRows.filter((r) => r.status !== "match").length,
            total_variance: `$${summaryRows[0].total_variance_dollars}`,
          },
          installments: {
            checked: (crmInvoices?.length || 0) + (loanScheds?.length || 0),
            mismatches: installRows.length,
            total_variance: `$${summaryRows[1].total_variance_dollars}`,
          },
          payments: {
            checked: tripPayments?.length || 0,
            mismatches: payRows.length,
            total_variance: `$${summaryRows[2].total_variance_dollars}`,
          },
        },
        files,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("recon error", e);
    await supabase.from("qbo_sync_logs").insert({
      sync_type: "recon-report",
      direction: "read",
      status: "error",
      records_processed: 0,
      error_message: String(e?.message || e),
      details: { run_id: runId },
    });
    return new Response(
      JSON.stringify({ error: String(e?.message || e), report_run_id: runId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});