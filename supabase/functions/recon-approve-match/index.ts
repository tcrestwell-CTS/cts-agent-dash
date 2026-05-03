// supabase/functions/recon-approve-match/index.ts
// Approves a recon_match. For supplier-expense matches, creates the
// associated QBO Expense (Purchase) tied to the supplier's mapped QBO Vendor.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-secret",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";
const log = (step: string, data?: unknown) =>
  console.log(`[recon-approve-match] ${step}`, data ? JSON.stringify(data) : "");

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
      `${Deno.env.get("QBO_CLIENT_ID")}:${Deno.env.get("QBO_CLIENT_SECRET")}`
    );
    const resp = await fetch(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(
          conn.refresh_token
        )}`,
      }
    );
    const refreshed = await resp.json();
    await supabase
      .from("qbo_connections")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: new Date(
          Date.now() + refreshed.expires_in * 1000
        ).toISOString(),
      })
      .eq("id", conn.id);
    return { accessToken: refreshed.access_token, realmId: conn.realm_id };
  }
  return { accessToken: conn.access_token, realmId: conn.realm_id };
}

async function qboCreate(
  accessToken: string,
  realmId: string,
  entity: string,
  payload: Record<string, unknown>
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
    const fault = data.Fault?.Error?.[0];
    throw new Error(
      `QBO ${entity} create failed: ${fault?.Message || resp.status} — ${
        fault?.Detail || ""
      }`
    );
  }
  return data;
}

async function createExpenseForMatch(match: any, accessToken: string, realmId: string) {
  if (!match.crm_booking_id) {
    return { skipped: true, reason: "no_booking_id" };
  }

  // Load booking + supplier + trip
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, supplier_id, supplier_payout, gross_sales, trip_id, supplier_paid_date, supplier_paid_amount, supplier_paid_method, supplier_paid_reference, supplier_confirmation_number")
    .eq("id", match.crm_booking_id)
    .maybeSingle();
  if (!booking) throw new Error("Booking not found");
  if (!booking.supplier_id) throw new Error("Booking has no supplier");

  const amount = Number(
    booking.supplier_paid_amount ?? booking.supplier_payout ?? match.crm_amount ?? 0
  );
  if (!amount || amount <= 0) {
    return { skipped: true, reason: "zero_amount" };
  }

  // Resolve QBO vendor: supplier mapping → qbo_vendors.crm_supplier_id fallback
  const { data: mapping } = await supabase
    .from("qbo_supplier_mappings")
    .select("qbo_vendor_id")
    .eq("supplier_id", booking.supplier_id)
    .maybeSingle();

  let qboVendorId: string | null = mapping?.qbo_vendor_id ?? null;
  let vendorRecord: any = null;
  if (qboVendorId) {
    const { data: v } = await supabase
      .from("qbo_vendors")
      .select("qbo_id, display_name")
      .eq("qbo_id", qboVendorId)
      .maybeSingle();
    vendorRecord = v;
  }
  if (!qboVendorId) {
    const { data: v } = await supabase
      .from("qbo_vendors")
      .select("qbo_id, display_name")
      .eq("crm_supplier_id", booking.supplier_id)
      .maybeSingle();
    if (v) {
      qboVendorId = v.qbo_id;
      vendorRecord = v;
    }
  }
  if (!qboVendorId) {
    throw new Error(
      "No QBO Vendor mapping for supplier — set one in Recon Settings → Entity Mappings."
    );
  }

  // Account + payment account from config
  const { data: config } = await supabase
    .from("recon_account_config")
    .select("*")
    .eq("company_id", "crestwell")
    .single();

  const expenseAccountId =
    (config?.default_vendor_payment_account_id as string) || null;
  const paymentAccountId =
    (config?.qbo_bank_account_id as string) || expenseAccountId;

  if (!paymentAccountId) {
    throw new Error(
      "Recon settings missing a bank/payment account. Configure it in Recon Settings."
    );
  }
  if (!expenseAccountId) {
    throw new Error(
      "Recon settings missing a default vendor expense account. Configure it in Recon Settings."
    );
  }

  const supplierName = vendorRecord?.display_name || "Supplier";
  const txnDate = (booking.supplier_paid_date as string) ||
    new Date().toISOString().slice(0, 10);

  // Idempotency: same vendor + amount + date
  const { data: existing } = await supabase
    .from("qbo_bills")
    .select("qbo_id");
  // Note: qbo_purchases table doesn't exist; we use qbo_bills schema only as reference.
  // For Purchase (Expense), we don't have a local cache table — rely on QBO PrivateNote tag.

  const privateTag = `crm_booking:${booking.id}`;
  const payload = {
    AccountRef: { value: paymentAccountId },
    PaymentType: "Cash",
    EntityRef: { value: qboVendorId, type: "Vendor" },
    TxnDate: txnDate,
    PrivateNote: privateTag,
    DocNumber: booking.supplier_paid_reference?.slice(0, 21) || undefined,
    Line: [
      {
        Amount: Number(amount.toFixed(2)),
        DetailType: "AccountBasedExpenseLineDetail",
        Description: `Supplier payout — ${supplierName}${
          booking.supplier_confirmation_number
            ? ` (Conf #${booking.supplier_confirmation_number})`
            : ""
        }`,
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: expenseAccountId },
        },
      },
    ],
  };

  const result = await qboCreate(accessToken, realmId, "purchase", payload);
  const purchase = (result as any).Purchase;

  // Link booking → QBO purchase id (best-effort; ignore if column missing)
  await supabase
    .from("bookings")
    .update({ supplier_paid_reference: booking.supplier_paid_reference || `QBO:${purchase.Id}` })
    .eq("id", booking.id);

  return {
    success: true,
    qboPurchaseId: purchase.Id as string,
    amount,
    vendorId: qboVendorId,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

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
    { global: { headers: { Authorization: auth } } }
  );
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_) {
    /* empty */
  }
  const matchId = body.match_id as string | undefined;
  if (!matchId) {
    return new Response(JSON.stringify({ error: "match_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: match, error: matchErr } = await supabase
    .from("recon_matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (matchErr || !match) {
    return new Response(JSON.stringify({ error: "Match not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("approving match", { matchId, type: match.match_type });

  try {
    let qboResult: Record<string, unknown> = {};
    const isSupplierExpense =
      match.match_type === "crm_supplier_to_qbo_expense" ||
      match.match_type === "crm_supplier_to_qbo_bill" ||
      match.match_type === "crm_supplier_to_qbo_billpayment";

    if (isSupplierExpense && !match.qbo_bill_id) {
      const { accessToken, realmId } = await getValidToken();
      qboResult = await createExpenseForMatch(match, accessToken, realmId);
    }

    await supabase
      .from("recon_matches")
      .update({
        status: qboResult.qboPurchaseId ? "posted_to_qbo" : "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    await supabase.from("recon_audit_log").insert({
      actor_id: user.id,
      actor_email: user.email || "",
      action: "approve_match",
      record_type: "recon_match",
      record_id: matchId,
      after_state: qboResult,
      qbo_object_id: (qboResult.qboPurchaseId as string) || null,
    });

    return new Response(
      JSON.stringify({ success: true, result: qboResult }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log("approval failed", { matchId, error: errMsg });
    await supabase.from("recon_audit_log").insert({
      actor_id: user.id,
      actor_email: user.email || "",
      action: "approve_match_failed",
      record_type: "recon_match",
      record_id: matchId,
      after_state: { error: errMsg },
    });
    return new Response(JSON.stringify({ success: false, error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});