import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * QBO Installment Restructure
 *
 * For each given trip:
 *   1. Voids the QBO Payments that are applied to the trip's existing single QBO Invoice
 *   2. Voids the existing single (gross) QBO Invoice
 *   3. Creates one QBO Invoice per `trip_payments` row (deposit + installments + final)
 *      dated on its due_date / payment_date, with DocNumber `<base>-N`
 *   4. Re-applies each previously-paid trip_payment as a QBO Payment to its matching
 *      new invoice (deposit/installment N), so the customer Statement shows:
 *        - Each installment as a dated invoice (open balance)
 *        - Each paid installment as a payment (closed)
 *   5. Updates qbo_invoices / qbo_payments / qbo_invoice_mappings local tables
 *
 * Body: { trip_ids: string[] }
 * Auth: service-role bearer (admin-only operation)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";

function fmt2(n: number) {
  return Math.round(n * 100) / 100;
}

function paymentLabel(pt: string, idx: number, total: number) {
  if (pt === "deposit") return "Deposit";
  if (pt === "final" || pt === "final_balance") return "Final Balance";
  return `Installment ${idx} of ${total}`;
}

async function refreshTokenIfNeeded(supabase: any, connection: any) {
  const tokenExpiry = new Date(connection.token_expires_at);
  if (tokenExpiry > new Date(Date.now() + 60_000)) return connection;

  const QBO_CLIENT_ID = Deno.env.get("QBO_CLIENT_ID")!;
  const QBO_CLIENT_SECRET = Deno.env.get("QBO_CLIENT_SECRET")!;
  const basicAuth = btoa(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`);

  const tokenResp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }),
  });

  if (!tokenResp.ok) {
    throw new Error(`Token refresh failed: ${await tokenResp.text()}`);
  }

  const tokens = await tokenResp.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase.from("qbo_connections").update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
  }).eq("id", connection.id);

  return { ...connection, access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expires_at: expiresAt };
}

async function qboFetch(url: string, headers: any, init: RequestInit = {}, retries = 4): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const r = await fetch(url, { ...init, headers });
    if (r.status !== 429 && r.status < 500) return r;
    await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
  }
  return await fetch(url, { ...init, headers });
}

async function processTrip(
  supabase: any,
  qboBase: string,
  qboHeaders: any,
  userId: string,
  tripId: string,
) {
  const result: any = { trip_id: tripId, steps: [] };

  // 1. Trip + client
  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .select("id, trip_name, client_id")
    .eq("id", tripId)
    .single();
  if (tripErr || !trip) throw new Error(`Trip ${tripId} not found`);
  result.trip_name = trip.trip_name;

  if (!trip.client_id) throw new Error("Trip has no client");

  const { data: clientMapping } = await supabase
    .from("qbo_client_mappings")
    .select("qbo_customer_id")
    .eq("user_id", userId)
    .eq("client_id", trip.client_id)
    .maybeSingle();
  if (!clientMapping?.qbo_customer_id) throw new Error("Client not mapped to QBO customer yet");
  const qboCustomerId = clientMapping.qbo_customer_id;
  result.qbo_customer_id = qboCustomerId;

  // 2. Trip payments
  const { data: payments } = await supabase
    .from("trip_payments")
    .select("id, payment_type, amount, status, due_date, payment_date, notes")
    .eq("trip_id", tripId)
    .order("due_date", { ascending: true, nullsFirst: true })
    .order("payment_date", { ascending: true });

  if (!payments || payments.length === 0) throw new Error("No trip_payments found");
  result.installment_count = payments.length;

  // 3. Existing local invoice for this trip
  const { data: localInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (!localInvoices || localInvoices.length === 0) throw new Error("No local invoice for trip");
  const localInvoice = localInvoices[0];
  const baseInvoiceNumber = localInvoice.invoice_number;

  const { data: existingMapping } = await supabase
    .from("qbo_invoice_mappings")
    .select("qbo_invoice_id")
    .eq("user_id", userId)
    .eq("invoice_id", localInvoice.id)
    .maybeSingle();
  const existingQboInvoiceId: string | null = existingMapping?.qbo_invoice_id || null;
  result.existing_qbo_invoice_id = existingQboInvoiceId;

  // 4. Void payments tied to that invoice, then void invoice
  if (existingQboInvoiceId) {
    const { data: paymentsToVoid } = await supabase
      .from("qbo_payments")
      .select("qbo_id")
      .eq("qbo_invoice_id", existingQboInvoiceId);

    for (const p of paymentsToVoid || []) {
      // Try DELETE first (removes cash entirely), then fall back to VOID
      // Need fresh SyncToken
      let syncToken = "0";
      const getPay = await qboFetch(`${qboBase}/payment/${p.qbo_id}`, qboHeaders);
      if (getPay.ok) {
        const j = await getPay.json();
        syncToken = j?.Payment?.SyncToken || "0";
      }

      const dr = await qboFetch(
        `${qboBase}/payment?operation=delete`,
        qboHeaders,
        {
          method: "POST",
          body: JSON.stringify({ Id: p.qbo_id, SyncToken: syncToken }),
        },
      );
      const dt = await dr.text();
      result.steps.push({ op: "delete_payment", qbo_id: p.qbo_id, status: dr.status, body: dt.slice(0, 300) });

      if (!dr.ok) {
        // Fall back to void
        const vr = await qboFetch(
          `${qboBase}/payment?operation=void`,
          qboHeaders,
          {
            method: "POST",
            body: JSON.stringify({ Id: p.qbo_id, SyncToken: syncToken }),
          },
        );
        const vt = await vr.text();
        result.steps.push({ op: "void_payment_fallback", qbo_id: p.qbo_id, status: vr.status, body: vt.slice(0, 300) });
      }

      await supabase.from("qbo_payments").delete().eq("qbo_id", p.qbo_id);
    }

    // Refresh sync token then void invoice
    const getInv = await qboFetch(`${qboBase}/invoice/${existingQboInvoiceId}`, qboHeaders);
    if (getInv.ok) {
      const j = await getInv.json();
      const syncToken = j?.Invoice?.SyncToken || "0";
      const v = await qboFetch(
        `${qboBase}/invoice?operation=void`,
        qboHeaders,
        {
          method: "POST",
          body: JSON.stringify({ Id: existingQboInvoiceId, SyncToken: syncToken }),
        },
      );
      result.steps.push({ op: "void_invoice", qbo_id: existingQboInvoiceId, status: v.status, body: (await v.text()).slice(0, 300) });
      await supabase.from("qbo_invoices").delete().eq("qbo_id", existingQboInvoiceId);
    } else {
      result.steps.push({ op: "void_invoice_skipped", qbo_id: existingQboInvoiceId, reason: "fetch failed" });
    }

    await supabase
      .from("qbo_invoice_mappings")
      .delete()
      .eq("user_id", userId)
      .eq("invoice_id", localInvoice.id);
  }

  // 5. Get default deposit account
  const { data: connection } = await supabase
    .from("qbo_connections")
    .select("default_bank_account_id, default_bank_account_name")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  let depositAccount: { id: string; name: string } | null = null;
  if (connection?.default_bank_account_id) {
    depositAccount = { id: connection.default_bank_account_id, name: connection.default_bank_account_name || "" };
  }

  // 6. Build per-installment invoices + payments
  const installments = payments.filter((p: any) => p.payment_type === "installment");
  const installmentTotal = installments.length;
  let installmentIdx = 0;

  const created: any[] = [];

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    const isInstallment = p.payment_type === "installment";
    if (isInstallment) installmentIdx++;

    const label = paymentLabel(p.payment_type, installmentIdx, installmentTotal);
    const txnDate = (p.due_date || p.payment_date)?.slice(0, 10);
    const dueDate = (p.due_date || p.payment_date)?.slice(0, 10);
    const docNumber = `${baseInvoiceNumber}-${String(i + 1).padStart(2, "0")}`.substring(0, 21);
    const amount = fmt2(Number(p.amount) || 0);
    if (amount <= 0) continue;

    const invoicePayload = {
      CustomerRef: { value: qboCustomerId },
      DocNumber: docNumber,
      TxnDate: txnDate,
      DueDate: dueDate,
      Line: [
        {
          Amount: amount,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef: { value: "1", name: "Services" },
          },
          Description: `${trip.trip_name} – ${label}`,
        },
      ],
    };

    let invJson: any;
    let newInv: any;
    const invResp = await qboFetch(`${qboBase}/invoice`, qboHeaders, {
      method: "POST",
      body: JSON.stringify(invoicePayload),
    });
    const invText = await invResp.text();
    if (!invResp.ok) {
      // Idempotency: if it already exists from a prior partial run, reuse it
      const isDup = invResp.status === 400 && /Duplicate Document Number/i.test(invText);
      if (!isDup) {
        result.steps.push({ op: "create_invoice_failed", payment_id: p.id, status: invResp.status, body: invText.slice(0, 500) });
        continue;
      }
      const docEsc = docNumber.replace(/'/g, "\\'");
      const q = await qboFetch(
        `${qboBase}/query?query=${encodeURIComponent(
          `SELECT * FROM Invoice WHERE CustomerRef = '${qboCustomerId}' AND DocNumber = '${docEsc}' MAXRESULTS 1`,
        )}`,
        qboHeaders,
      );
      if (!q.ok) {
        result.steps.push({ op: "create_invoice_failed", payment_id: p.id, status: invResp.status, body: invText.slice(0, 500) });
        continue;
      }
      const qj = await q.json();
      newInv = qj?.QueryResponse?.Invoice?.[0];
      if (!newInv) {
        result.steps.push({ op: "create_invoice_failed", payment_id: p.id, status: invResp.status, body: invText.slice(0, 500) });
        continue;
      }
      invJson = { Invoice: newInv };
      result.steps.push({ op: "reuse_existing_invoice", doc: docNumber, qbo_id: newInv.Id, amount });
    } else {
      invJson = JSON.parse(invText);
      newInv = invJson.Invoice;
      result.steps.push({ op: "create_invoice", doc: docNumber, qbo_id: newInv.Id, amount });
    }

    await supabase.from("qbo_invoices").upsert({
      qbo_id: newInv.Id,
      qbo_customer_id: qboCustomerId,
      crm_booking_id: null,
      doc_number: docNumber,
      total_amt: amount,
      balance: newInv.Balance ?? amount,
      due_date: dueDate,
      txn_date: txnDate,
      status: (newInv.Balance ?? amount) > 0 ? "Open" : "Paid",
      trigger_managed: true,
      sync_token: newInv.SyncToken,
      raw_payload: invJson.Invoice,
      synced_at: new Date().toISOString(),
    }, { onConflict: "qbo_id" });

    const newQboInvoiceId = newInv.Id;

    // Save mapping for the FIRST invoice so the local invoice has a stable QBO id pointer
    if (i === 0) {
      await supabase.from("qbo_invoice_mappings").upsert({
        user_id: userId,
        invoice_id: localInvoice.id,
        qbo_invoice_id: newQboInvoiceId,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "user_id,invoice_id" });
    }

    // 7. If this trip_payment is paid, create a QBO Payment applied to it
    if (p.status === "paid") {
      // Idempotency: skip if we already have a qbo_payment row for this crm_payment + invoice
      const { data: existingPay } = await supabase
        .from("qbo_payments")
        .select("qbo_id")
        .eq("crm_payment_id", p.id)
        .eq("qbo_invoice_id", newQboInvoiceId)
        .maybeSingle();
      if (existingPay) {
        result.steps.push({ op: "skip_existing_payment", qbo_id: existingPay.qbo_id });
        created.push({ doc: docNumber, qbo_id: newQboInvoiceId });
        await new Promise((res) => setTimeout(res, 250));
        continue;
      }
      const payTxnDate = (p.payment_date || p.due_date)?.slice(0, 10);
      const payPayload: any = {
        CustomerRef: { value: qboCustomerId },
        TotalAmt: amount,
        TxnDate: payTxnDate,
        PrivateNote: `Restructured – ${label} – ${trip.trip_name}`,
        Line: [
          {
            Amount: amount,
            LinkedTxn: [{ TxnId: newQboInvoiceId, TxnType: "Invoice" }],
          },
        ],
      };
      if (depositAccount?.id) {
        payPayload.DepositToAccountRef = { value: depositAccount.id, name: depositAccount.name };
      }

      const payResp = await qboFetch(`${qboBase}/payment`, qboHeaders, {
        method: "POST",
        body: JSON.stringify(payPayload),
      });
      const payText = await payResp.text();
      if (!payResp.ok) {
        result.steps.push({ op: "create_payment_failed", payment_id: p.id, status: payResp.status, body: payText.slice(0, 500) });
      } else {
        const payJson = JSON.parse(payText);
        const newPay = payJson.Payment;
        result.steps.push({ op: "create_payment", qbo_id: newPay.Id, amount, applied_to: newQboInvoiceId });

        await supabase.from("qbo_payments").upsert({
          qbo_id: newPay.Id,
          qbo_customer_id: qboCustomerId,
          qbo_invoice_id: newQboInvoiceId,
          crm_payment_id: p.id,
          total_amt: amount,
          txn_date: payTxnDate,
          payment_ref_num: newPay.PaymentRefNum || null,
          trigger_managed: true,
          sync_token: newPay.SyncToken,
          raw_payload: payJson.Payment,
          synced_at: new Date().toISOString(),
        }, { onConflict: "qbo_id" });
      }
    }

    created.push({ doc: docNumber, qbo_id: newQboInvoiceId });

    // brief pause to be polite to QBO API
    await new Promise((res) => setTimeout(res, 250));
  }

  result.created = created;
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
  }

  const tripIds: string[] = Array.isArray(body?.trip_ids) ? body.trip_ids : [];
  if (tripIds.length === 0) {
    return new Response(JSON.stringify({ error: "trip_ids required" }), { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve user/connection from the first trip
  const { data: firstTrip } = await supabase
    .from("trips")
    .select("user_id")
    .eq("id", tripIds[0])
    .single();
  if (!firstTrip?.user_id) {
    return new Response(JSON.stringify({ error: "Cannot resolve user_id for trips" }), { status: 400, headers: corsHeaders });
  }

  let { data: connection } = await supabase
    .from("qbo_connections")
    .select("*")
    .eq("user_id", firstTrip.user_id)
    .eq("is_active", true)
    .single();
  if (!connection) {
    return new Response(JSON.stringify({ error: "No active QBO connection" }), { status: 400, headers: corsHeaders });
  }

  connection = await refreshTokenIfNeeded(supabase, connection);
  const qboBase = `${QBO_BASE}/${connection.realm_id}`;
  const qboHeaders = {
    Authorization: `Bearer ${connection.access_token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const results: any[] = [];
  for (const tripId of tripIds) {
    try {
      const r = await processTrip(supabase, qboBase, qboHeaders, firstTrip.user_id, tripId);
      results.push({ ok: true, ...r });
    } catch (err: any) {
      results.push({ ok: false, trip_id: tripId, error: err.message });
    }
  }

  await supabase.from("qbo_sync_logs").insert({
    user_id: firstTrip.user_id,
    sync_type: "restructure-installments",
    direction: "push",
    status: results.every((r) => r.ok) ? "success" : "partial",
    records_processed: results.filter((r) => r.ok).length,
    details: { results },
  });

  return new Response(JSON.stringify({ results }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});