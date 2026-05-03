// supabase/functions/recon-approvals/index.ts
// Executes approved QBO writes from approval_tasks
// This is the ONLY function that writes to QBO
// Every write is audit logged with before/after state

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";
const log = (step: string, data?: unknown) =>
  console.log(`[recon-approvals] ${step}`, data ? JSON.stringify(data) : "");

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
    const clientId = Deno.env.get("QBO_CLIENT_ID")!;
    const clientSecret = Deno.env.get("QBO_CLIENT_SECRET")!;
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const resp = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(conn.refresh_token)}`,
      }
    );
    const refreshed = await resp.json();
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

async function qboCreate(
  accessToken: string,
  realmId: string,
  entityType: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = `${QBO_BASE}/${realmId}/${entityType.toLowerCase()}?minorversion=65`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (resp.status === 429) {
    log("QBO rate limited — retrying in 10s");
    await new Promise((r) => setTimeout(r, 10000));
    return qboCreate(accessToken, realmId, entityType, payload);
  }

  const data = await resp.json();

  if (!resp.ok) {
    const fault = data.Fault?.Error?.[0];
    throw new Error(
      `QBO ${entityType} create failed: ${fault?.Message || resp.status} — ${fault?.Detail || ""}`
    );
  }

  return data;
}

async function auditLog(params: {
  actorId: string;
  actorEmail: string;
  action: string;
  recordType: string;
  recordId: string;
  beforeState?: unknown;
  afterState?: unknown;
  qboObjectId?: string;
  sourceEventId?: string;
}) {
  await supabase.from("recon_audit_log").insert({
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    record_type: params.recordType,
    record_id: params.recordId,
    before_state: params.beforeState || null,
    after_state: params.afterState || null,
    qbo_object_id: params.qboObjectId || null,
    source_event_id: params.sourceEventId || null,
  });
}

async function executeCreateQBOPayment(
  task: Record<string, unknown>,
  accessToken: string,
  realmId: string
) {
  log("creating QBO Payment", { taskId: task.id });
  const payload = task.action_payload as Record<string, unknown>;

  const { data: existing } = await supabase
    .from("qbo_payments")
    .select("qbo_id")
    .eq("qbo_customer_id", (payload.CustomerRef as Record<string, string>)?.value)
    .eq("total_amt", payload.TotalAmt)
    .eq("txn_date", payload.TxnDate)
    .maybeSingle();

  if (existing) {
    log("duplicate QBO payment detected — skipping", { qboId: existing.qbo_id });
    return { skipped: true, reason: "duplicate", qboId: existing.qbo_id };
  }

  const result = await qboCreate(accessToken, realmId, "payment", payload);
  const qboPayment = (result as Record<string, unknown>).Payment as Record<string, unknown>;

  await supabase.from("qbo_payments").insert({
    qbo_id: qboPayment.Id,
    qbo_customer_id: (qboPayment.CustomerRef as Record<string, string>)?.value,
    total_amt: qboPayment.TotalAmt,
    txn_date: qboPayment.TxnDate,
    payment_ref_num: qboPayment.PaymentRefNum || null,
    trigger_managed: false,
    sync_token: qboPayment.SyncToken,
    raw_payload: qboPayment,
    synced_at: new Date().toISOString(),
  });

  return { success: true, qboId: qboPayment.Id as string, result };
}

async function executeCreateQBODeposit(
  task: Record<string, unknown>,
  accessToken: string,
  realmId: string,
  config: Record<string, unknown>
) {
  log("creating QBO Deposit", { taskId: task.id });
  const payload = task.action_payload as Record<string, unknown>;

  const depositPayload = {
    ...payload,
    DepositToAccountRef: {
      value: config.qbo_bank_account_id || payload.DepositToAccountRef,
    },
  };

  const { data: existing } = await supabase
    .from("qbo_deposits")
    .select("qbo_id")
    .eq("total_amt", payload.TotalAmt)
    .eq("txn_date", payload.TxnDate)
    .maybeSingle();

  if (existing) {
    log("duplicate QBO deposit detected — skipping", { qboId: existing.qbo_id });
    return { skipped: true, reason: "duplicate", qboId: existing.qbo_id };
  }

  const result = await qboCreate(accessToken, realmId, "deposit", depositPayload);
  const qboDeposit = (result as Record<string, unknown>).Deposit as Record<string, unknown>;

  await supabase.from("qbo_deposits").insert({
    qbo_id: qboDeposit.Id,
    deposit_to_account_id: (qboDeposit.DepositToAccountRef as Record<string, string>)?.value,
    total_amt: qboDeposit.TotalAmt,
    txn_date: qboDeposit.TxnDate,
    memo: qboDeposit.PrivateNote || null,
    trigger_managed: false,
    sync_token: qboDeposit.SyncToken,
    raw_payload: qboDeposit,
    synced_at: new Date().toISOString(),
  });

  return { success: true, qboId: qboDeposit.Id as string, result };
}

async function executeCreateQBOBillPayment(
  task: Record<string, unknown>,
  accessToken: string,
  realmId: string
) {
  log("creating QBO BillPayment", { taskId: task.id });
  const payload = task.action_payload as Record<string, unknown>;

  const { data: existing } = await supabase
    .from("qbo_bill_payments")
    .select("qbo_id")
    .eq("qbo_vendor_id", (payload.VendorRef as Record<string, string>)?.value)
    .eq("total_amt", payload.TotalAmt)
    .eq("txn_date", payload.TxnDate)
    .maybeSingle();

  if (existing) {
    log("duplicate QBO bill payment detected — skipping", { qboId: existing.qbo_id });
    return { skipped: true, reason: "duplicate", qboId: existing.qbo_id };
  }

  const result = await qboCreate(accessToken, realmId, "billpayment", payload);
  const qboBP = (result as Record<string, unknown>).BillPayment as Record<string, unknown>;

  await supabase.from("qbo_bill_payments").insert({
    qbo_id: qboBP.Id,
    qbo_vendor_id: (qboBP.VendorRef as Record<string, string>)?.value,
    total_amt: qboBP.TotalAmt,
    txn_date: qboBP.TxnDate,
    payment_ref_num: qboBP.DocNumber || null,
    trigger_managed: false,
    sync_token: qboBP.SyncToken,
    raw_payload: qboBP,
    synced_at: new Date().toISOString(),
  });

  return { success: true, qboId: qboBP.Id as string, result };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = req.headers.get("x-agent-secret");
  const expected = Deno.env.get("AGENT_SECRET") ?? Deno.env.get("CW_AGENT_SECRET");
  if (!expected || secret !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { task_id, approved_by, approved_by_email } = body;

  if (!task_id) {
    return new Response(
      JSON.stringify({ error: "task_id required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: task, error: taskError } = await supabase
    .from("approval_tasks")
    .select("*, recon_matches(*)")
    .eq("id", task_id)
    .eq("status", "pending")
    .single();

  if (taskError || !task) {
    return new Response(
      JSON.stringify({ error: "Task not found or already processed" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  log("processing approval", { taskId: task_id, actionType: task.action_type });

  const { data: config } = await supabase
    .from("recon_account_config")
    .select("*")
    .eq("company_id", "crestwell")
    .single();

  const txnDate = (task.action_payload as Record<string, unknown>)?.TxnDate as string;
  if (config?.closed_period_cutoff && txnDate) {
    if (new Date(txnDate) < new Date(config.closed_period_cutoff)) {
      await supabase
        .from("approval_tasks")
        .update({ status: "rejected", rejection_reason: "Closed period — admin approval required" })
        .eq("id", task_id);

      return new Response(
        JSON.stringify({
          error: "Transaction date is in a closed period. Admin must approve manually.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  try {
    const { accessToken, realmId } = await getValidToken();
    let writeResult: Record<string, unknown> = {};

    switch (task.action_type) {
      case "create_qbo_payment":
        writeResult = await executeCreateQBOPayment(task, accessToken, realmId);
        break;
      case "create_qbo_deposit":
        writeResult = await executeCreateQBODeposit(task, accessToken, realmId, config || {});
        break;
      case "create_qbo_expense":
        writeResult = await executeCreateQBOExpense(task, accessToken, realmId);
        break;
      default:
        throw new Error(`Unknown action_type: ${task.action_type}`);
    }

    await supabase
      .from("approval_tasks")
      .update({
        status: writeResult.skipped ? "skipped" : "approved",
        approved_by,
        approved_at: new Date().toISOString(),
        qbo_response: writeResult.result || writeResult,
        qbo_object_id: writeResult.qboId || null,
      })
      .eq("id", task_id);

    if (task.recon_match_id) {
      await supabase
        .from("recon_matches")
        .update({
          status: "posted_to_qbo",
          approved_by,
          approved_at: new Date().toISOString(),
        })
        .eq("id", task.recon_match_id);
    }

    await auditLog({
      actorId: approved_by,
      actorEmail: approved_by_email || "",
      action: `approved_${task.action_type}`,
      recordType: "approval_task",
      recordId: task_id,
      beforeState: task.action_payload,
      afterState: writeResult,
      qboObjectId: writeResult.qboId as string,
    });

    log("approval executed successfully", { taskId: task_id, qboId: writeResult.qboId });

    return new Response(
      JSON.stringify({ success: true, result: writeResult }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log("approval execution failed", { taskId: task_id, error: errMsg });

    await supabase
      .from("approval_tasks")
      .update({ status: "failed", rejection_reason: errMsg })
      .eq("id", task_id);

    await supabase.from("recon_dead_letter_queue").insert({
      source_system: "recon-approvals",
      event_type: task.action_type,
      payload: task,
      error_message: errMsg,
      status: "failed",
    });

    await auditLog({
      actorId: approved_by,
      actorEmail: approved_by_email || "",
      action: `failed_${task.action_type}`,
      recordType: "approval_task",
      recordId: task_id,
      afterState: { error: errMsg },
    });

    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});