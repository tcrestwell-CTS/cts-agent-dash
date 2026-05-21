import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Automated QBO sync triggered by database webhooks (pg_net).
 * Called with service-role key — no user auth required.
 *
 * Supported trigger_type values:
 *   - booking_confirmed
 *   - commission_received
 *   - payout_approved
 *   - deposit_posted
 *   - supplier_paid
 *   - trip_completed
 *   - client_created
 *   - supplier_created
 *   - loan_repayment_posted
 *   - apply_payment_to_invoice
 *   - invoice_updated
 */

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { trigger_type, record, old_record } = body;
  if (!trigger_type || !record) {
    return new Response(JSON.stringify({ error: "Missing trigger_type or record" }), { status: 400 });
  }

  const userId = record.user_id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "No user_id on record" }), { status: 400 });
  }

  // ── Get active QBO connection for this user ──
  const { data: connection } = await supabase
    .from("qbo_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!connection) {
    // No QBO connection — silently skip (not an error)
    return new Response(JSON.stringify({ skipped: true, reason: "No active QBO connection" }), { status: 200 });
  }

  // ── Auto-refresh token if near expiry ──
  const tokenExpiry = new Date(connection.token_expires_at);
  if (tokenExpiry <= new Date(Date.now() + 60_000)) {
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
      await supabase.from("qbo_connections").update({ is_active: false }).eq("id", connection.id);
      await logSync(supabase, userId, trigger_type, "error", 0, "Token refresh failed during auto-sync");
      return new Response(JSON.stringify({ error: "Token refresh failed" }), { status: 500 });
    }

    const tokens = await tokenResp.json();
    connection.access_token = tokens.access_token;
    connection.refresh_token = tokens.refresh_token;
    await supabase.from("qbo_connections").update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }).eq("id", connection.id);
  }

  const qboBase = `${QBO_BASE}/${connection.realm_id}`;
  const qboHeaders = {
    Authorization: `Bearer ${connection.access_token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  try {
    switch (trigger_type) {
      case "booking_confirmed":
        await handleBookingConfirmed(supabase, qboBase, qboHeaders, userId, record);
        break;
      case "commission_received":
        await handleCommissionReceived(supabase, qboBase, qboHeaders, userId, record);
        break;
      case "payout_approved":
        await handlePayoutApproved(supabase, qboBase, qboHeaders, userId, record);
        break;
      case "deposit_posted":
        await handleDepositPosted(supabase, qboBase, qboHeaders, userId, record, connection);
        break;
      case "client_payment_received":
        await handleClientPaymentReceived(supabase, qboBase, qboHeaders, userId, record, connection);
        break;
      case "supplier_paid":
        await handleSupplierPaid(supabase, qboBase, qboHeaders, userId, record, connection);
        break;
      case "trip_completed":
        await handleTripCompleted(supabase, qboBase, qboHeaders, userId, record);
        break;
      case "client_created":
        await handleClientCreated(supabase, qboBase, qboHeaders, userId, record);
        break;
      case "supplier_created":
        await handleSupplierCreated(supabase, qboBase, qboHeaders, userId, record);
        break;
      case "loan_repayment_posted":
        await handleLoanRepaymentPosted(supabase, qboBase, qboHeaders, userId, record);
        break;
      case "apply_payment_to_invoice":
        await handleApplyPaymentToInvoice(supabase, qboBase, qboHeaders, userId, record);
        break;
      case "invoice_updated":
        await handleInvoiceUpdated(supabase, qboBase, qboHeaders, userId, record);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown trigger_type: ${trigger_type}` }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true, trigger_type }), { status: 200 });
  } catch (err: any) {
    console.error(`[qbo-sync-trigger] ${trigger_type} error:`, err);
    // Normalize trigger_type to hyphens so error logs share the same sync_type
    // as success logs (auto-client-payment-received, auto-supplier-paid, etc.).
    // Otherwise the dashboard surfaces phantom "duplicate trigger" pairs.
    const normalized = String(trigger_type).replace(/_/g, "-");
    await logSync(supabase, userId, `auto-${normalized}`, "error", 0, err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// HANDLERS
// ────────────────────────────────────────────────────────────────────────────

/** Booking confirmed → sync client as QBO Customer + create QBO Invoice */
async function handleBookingConfirmed(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, booking: any
) {
  // Resolve trip + client (bookings hold no client_id directly).
  if (!booking.trip_id) throw new Error("Booking has no trip_id");
  const { data: trip } = await supabase
    .from("trips")
    .select("id, client_id, trip_name")
    .eq("id", booking.trip_id)
    .single();
  if (!trip?.client_id) throw new Error(`Trip ${booking.trip_id} has no client`);

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", trip.client_id)
    .single();
  if (!client) throw new Error(`Client ${trip.client_id} not found`);

  const qboCustomerId = await ensureQBOCustomer(supabase, qboBase, qboHeaders, userId, client);

  // ── 1. Ensure local CRM invoice exists (idempotent — DB trigger may have made it).
  let { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount")
    .eq("trip_id", booking.trip_id)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const amount = Number(booking.gross_sales ?? booking.total_price ?? 0);
  if (amount <= 0) {
    throw new Error(
      `Booking ${booking.id} has no positive gross_sales/total_price; refusing to create $0 invoice`
    );
  }

  if (!invoice) {
    // Generate via the same RPC the rest of the system uses
    const { data: invNum, error: invNumErr } = await supabase
      .rpc("get_next_invoice_number", { p_user_id: userId });
    if (invNumErr) throw new Error(`get_next_invoice_number failed: ${invNumErr.message}`);

    const { data: created, error: createErr } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        invoice_number: invNum,
        client_id: trip.client_id,
        client_name: client.name,
        trip_id: booking.trip_id,
        trip_name: trip.trip_name,
        total_amount: amount,
        amount_remaining: amount,
        status: "sent",
      })
      .select("id, invoice_number, total_amount")
      .single();
    if (createErr) throw new Error(`Local invoice insert failed: ${createErr.message}`);
    invoice = created;
  }

  // ── 2. Idempotency: skip if already mapped to QBO.
  const { data: existingMap } = await supabase
    .from("qbo_invoice_mappings")
    .select("qbo_invoice_id")
    .eq("invoice_id", invoice.id)
    .maybeSingle();
  if (existingMap?.qbo_invoice_id) {
    await logSync(supabase, userId, "auto-booking-confirmed", "success", 0,
      undefined, { booking_id: booking.id, invoice_id: invoice.id, skipped: "already_mapped",
      qbo_invoice_id: existingMap.qbo_invoice_id });
    return;
  }

  // ── 3. Create QBO Invoice using the canonical CRM invoice number as DocNumber.
  const docNum = String(invoice.invoice_number).substring(0, 21);
  const invoiceData: any = {
    CustomerRef: { value: qboCustomerId },
    Line: [
      {
        Amount: Number(invoice.total_amount ?? amount),
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: { ItemRef: { value: "1", name: "Services" } },
        Description: `Booking ${booking.confirmation_number ?? booking.id} — ${trip.trip_name ?? "Travel"}`,
      },
    ],
    DocNumber: docNum,
    TxnDate: (booking.created_at ?? new Date().toISOString()).split("T")[0],
  };

  const resp = await qboFetch(`${qboBase}/invoice`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(invoiceData),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`QBO Invoice creation failed: ${errBody}`);
  }
  const result = await resp.json();
  const qboInvoiceId = result?.Invoice?.Id;
  if (!qboInvoiceId) throw new Error("QBO Invoice response missing Id");

  // ── 4. Persist mapping.
  const { error: mapErr } = await supabase
    .from("qbo_invoice_mappings")
    .upsert({
      user_id: userId,
      invoice_id: invoice.id,
      qbo_invoice_id: qboInvoiceId,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "user_id,invoice_id" });
  if (mapErr) {
    // Log but don't fail — QBO invoice exists; mapping can be repaired.
    console.error(`[booking_confirmed] mapping upsert failed: ${mapErr.message}`);
  }

  await logSync(supabase, userId, "auto-booking-confirmed", "success", 1, undefined, {
    booking_id: booking.id,
    invoice_id: invoice.id,
    qbo_invoice_id: qboInvoiceId,
    amount: invoice.total_amount,
  });
}

/** Commission received (status → paid) → create QBO Journal Entry */
async function handleCommissionReceived(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, commission: any
) {
  const journalEntry = {
    Line: [
      {
        JournalEntryLineDetail: {
          PostingType: "Debit",
          AccountRef: { value: "1", name: "Checking" },
        },
        DetailType: "JournalEntryLineDetail",
        Amount: commission.amount,
        Description: `Commission received – Booking ${commission.booking_id}`,
      },
      {
        JournalEntryLineDetail: {
          PostingType: "Credit",
          AccountRef: { value: "1", name: "Commission Income" },
        },
        DetailType: "JournalEntryLineDetail",
        Amount: commission.amount,
        Description: `Commission received – Booking ${commission.booking_id}`,
      },
    ],
    TxnDate: commission.paid_date || new Date().toISOString().split("T")[0],
  };

  const resp = await qboFetch(`${qboBase}/journalentry`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(journalEntry),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`QBO JournalEntry failed: ${errBody}`);
  }

  await logSync(supabase, userId, "auto-commission-received", "success", 1);
}

/** Advisor payout approved → create QBO Expense (payout to advisor)
 *  Phase 4: Uses advisor_margin_amount from the margin engine when available,
 *  falls back to commission_override_amount → commission_revenue for legacy. */
async function handlePayoutApproved(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, booking: any
) {
  const payoutAmount = booking.advisor_margin_amount
    || booking.commission_override_amount
    || booking.commission_revenue
    || 0;

  const agencyRetained = booking.agency_margin_amount || 0;

  const expense = {
    PaymentType: "Check",
    TotalAmt: payoutAmount,
    Line: [
      {
        Amount: payoutAmount,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: "1", name: "Commission Expense" },
        },
        Description: `Advisor payout – Booking ${booking.booking_reference} (advisor share: ${payoutAmount}, agency retained: ${agencyRetained})`,
      },
    ],
    TxnDate: booking.override_approved_at?.split("T")[0] || new Date().toISOString().split("T")[0],
  };

  const resp = await qboFetch(`${qboBase}/purchase`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(expense),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`QBO Expense (payout) failed: ${errBody}`);
  }

  await logSync(supabase, userId, "auto-payout-approved", "success", 1);
}

/**
 * Deposit posted (trip_payment with type 'deposit' and status 'completed')
 * → Stripe Clearing Account flow:
 *   1. Payment received into Stripe Clearing account
 *   2. Stripe processing fees recorded as expense
 *   3. Net transfer from Stripe Clearing → Bank account
 *   Result: Clearing account zeroes out, fees tracked, bank reflects net deposit
 */
async function handleDepositPosted(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, payment: any, connection?: any
) {
  // Try to find the client via the trip
  let qboCustomerId = "1"; // fallback
  if (payment.trip_id) {
    const { data: trip } = await supabase
      .from("trips")
      .select("client_id")
      .eq("id", payment.trip_id)
      .single();

    if (trip?.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("id", trip.client_id)
        .single();

      if (client) {
        qboCustomerId = await ensureQBOCustomer(supabase, qboBase, qboHeaders, userId, client);
      }
    }
  }

  // Auto-provision required QBO accounts
  const stripeClearingId = await ensureQBOAccount(qboBase, qboHeaders, "Stripe Clearing", "Other Current Asset", "OtherCurrentAsset");
  const stripeFeesId = await ensureQBOAccount(qboBase, qboHeaders, "Stripe Processing Fees", "Expense", "Expense");

  const grossAmount = payment.amount || 0;
  const stripeFeeRate = 0.029;
  const stripeFixedFee = 0.30;
  const stripeFee = Math.round((grossAmount * stripeFeeRate + stripeFixedFee) * 100) / 100;
  const netAmount = Math.round((grossAmount - stripeFee) * 100) / 100;
  const txnDate = payment.payment_date || new Date().toISOString().split("T")[0];
  // Include PI id in memo so the Stripe ↔ QBO reconciler can match by reference.
  const piTag = payment.stripe_payment_intent_id ? ` [${payment.stripe_payment_intent_id}]` : "";
  const memo = `Stripe/Affirm deposit – ${payment.details || payment.notes || "Trip payment"}${piTag}`;

  // ── Step 1: Gross → Stripe Clearing ──
  const step1 = {
    TxnDate: txnDate,
    PrivateNote: `${memo} – Gross payment received`,
    Line: [
      {
        Amount: grossAmount,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Debit",
          AccountRef: { value: stripeClearingId, name: "Stripe Clearing" },
        },
        Description: `Gross payment received – ${payment.details || "Deposit"}`,
      },
      {
        Amount: grossAmount,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Credit",
          AccountRef: { name: "Accounts Receivable (A/R)" },
          EntityRef: { value: qboCustomerId, type: "Customer" },
        },
        Description: `Gross payment received – ${payment.details || "Deposit"}`,
      },
    ],
  };

  const resp1 = await qboFetch(`${qboBase}/journalentry`, {
    method: "POST", headers: qboHeaders, body: JSON.stringify(step1),
  });
  if (!resp1.ok) {
    const err = await resp1.text();
    throw new Error(`Stripe Clearing step 1 failed: ${err}`);
  }

  // ── Step 2: Fees ──
  const step2 = {
    TxnDate: txnDate,
    PrivateNote: `${memo} – Processing fees`,
    Line: [
      {
        Amount: stripeFee,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Debit",
          AccountRef: { value: stripeFeesId, name: "Stripe Processing Fees" },
        },
        Description: `Stripe/Affirm processing fee`,
      },
      {
        Amount: stripeFee,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Credit",
          AccountRef: { value: stripeClearingId, name: "Stripe Clearing" },
        },
        Description: `Stripe/Affirm processing fee`,
      },
    ],
  };

  const resp2 = await qboFetch(`${qboBase}/journalentry`, {
    method: "POST", headers: qboHeaders, body: JSON.stringify(step2),
  });
  if (!resp2.ok) {
    const err = await resp2.text();
    throw new Error(`Stripe Clearing step 2 (fees) failed: ${err}`);
  }

  // ── Step 3: Net → Bank ──
  const bankAccount = await resolvePaymentAccount(
    qboBase, qboHeaders,
    connection?.default_bank_account_id, connection?.default_bank_account_name,
    "Bank"
  );
  const step3 = {
    TxnDate: txnDate,
    PrivateNote: `${memo} – Net payout to bank`,
    Line: [
      {
        Amount: netAmount,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Debit",
          AccountRef: { value: bankAccount.id, name: bankAccount.name },
        },
        Description: `Net Stripe payout to bank`,
      },
      {
        Amount: netAmount,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Credit",
          AccountRef: { value: stripeClearingId, name: "Stripe Clearing" },
        },
        Description: `Net Stripe payout to bank`,
      },
    ],
  };

  const resp3 = await qboFetch(`${qboBase}/journalentry`, {
    method: "POST", headers: qboHeaders, body: JSON.stringify(step3),
  });
  if (!resp3.ok) {
    const err = await resp3.text();
    throw new Error(`Stripe Clearing step 3 (net transfer) failed: ${err}`);
  }

  await logSync(supabase, userId, "auto-deposit-posted", "success", 3, undefined, {
    gross: grossAmount, stripe_fee: stripeFee, net: netAmount,
    accounts_provisioned: { stripe_clearing: stripeClearingId, stripe_fees: stripeFeesId },
  });
}

/**
 * Supplier paid → create QBO Bill + BillPayment against the vendor.
 * The supplier is auto-synced as a QBO Vendor if not already mapped.
 */
async function handleSupplierPaid(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, booking: any, connection?: any
) {
  // 1. Ensure supplier exists as a QBO Vendor
  let qboVendorId: string | null = null;
  if (booking.supplier_id) {
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", booking.supplier_id)
      .single();

    if (supplier) {
      qboVendorId = await ensureQBOVendor(supabase, qboBase, qboHeaders, userId, supplier);
    }
  }

  // 2. Auto-provision the Accounts Payable account (QBO usually has one by default)
  const apAccountId = await ensureQBOAccount(qboBase, qboHeaders, "Accounts Payable (A/P)", "Accounts Payable", "AccountsPayable");
  const supplierExpenseId = await ensureQBOAccount(qboBase, qboHeaders, "Supplier Expense", "Expense", "OtherMiscellaneousServiceCost");

  const amount = booking.supplier_paid_amount || booking.supplier_payout || 0;
  const txnDate = booking.supplier_paid_date || new Date().toISOString().split("T")[0];

  // Get supplier name for memo
  let supplierName = "Supplier";
  if (booking.supplier_id) {
    const { data: sup } = await supabase.from("suppliers").select("name").eq("id", booking.supplier_id).single();
    if (sup) supplierName = sup.name;
  }

  const memo = `Supplier payment – ${supplierName} – Booking ${booking.confirmation_number || booking.id}`;

  // 3. Create a QBO Bill (represents what we owe the vendor)
  const billData: any = {
    TxnDate: txnDate,
    PrivateNote: memo,
    Line: [
      {
        Amount: amount,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: supplierExpenseId, name: "Supplier Expense" },
        },
        Description: memo,
      },
    ],
  };

  if (qboVendorId) {
    billData.VendorRef = { value: qboVendorId };
  }

  const billResp = await qboFetch(`${qboBase}/bill`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(billData),
  });

  if (!billResp.ok) {
    const errBody = await billResp.text();
    throw new Error(`QBO Bill creation failed: ${errBody}`);
  }

  const billResult = await billResp.json();
  const billId = billResult.Bill.Id;

  // 4. Create a QBO BillPayment (marks the bill as paid)
  const paymentMethod = booking.supplier_paid_method || "check";
  const billPaymentData: any = {
    VendorRef: qboVendorId ? { value: qboVendorId } : undefined,
    TotalAmt: amount,
    PayType: paymentMethod === "credit_card" ? "CreditCard" : "Check",
    TxnDate: txnDate,
    PrivateNote: `Payment – ${memo}`,
    Line: [
      {
        Amount: amount,
        LinkedTxn: [{ TxnId: billId, TxnType: "Bill" }],
      },
    ],
  };

  if (paymentMethod === "credit_card") {
    // Resolve credit card account: prefer configured, then auto-detect first QBO "Credit Card" account
    const ccAccount = await resolvePaymentAccount(
      qboBase, qboHeaders,
      connection?.default_cc_account_id, connection?.default_cc_account_name,
      "Credit Card"
    );
    billPaymentData.CreditCardPayment = {
      CCAccountRef: { value: ccAccount.id, name: ccAccount.name },
    };
  } else {
    // Resolve bank account: prefer configured, then auto-detect first Bank, else fallback
    const bankAccount = await resolvePaymentAccount(
      qboBase, qboHeaders,
      connection?.default_bank_account_id, connection?.default_bank_account_name,
      "Bank"
    );
    billPaymentData.CheckPayment = {
      BankAccountRef: { value: bankAccount.id, name: bankAccount.name },
    };
  }

  const payResp = await qboFetch(`${qboBase}/billpayment`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(billPaymentData),
  });

  if (!payResp.ok) {
    const errBody = await payResp.text();
    // Bill was created but payment failed — log but don't lose the bill
    console.error(`QBO BillPayment failed (Bill ${billId} exists):`, errBody);
    await logSync(supabase, userId, "auto-supplier-paid", "partial", 1, `Bill created (${billId}), BillPayment failed: ${errBody}`, {
      amount, bill_id: billId, vendor_id: qboVendorId,
    });
    return;
  }

  await logSync(supabase, userId, "auto-supplier-paid", "success", 2, undefined, {
    amount,
    booking_id: booking.id,
    bill_id: billId,
    vendor_id: qboVendorId,
    supplier_name: supplierName,
  });
}

/**
 * Trip completed (revenue recognition)
 * → Debit "Client Deposit" (liability), Credit "Commission Revenue"
 */
async function handleTripCompleted(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, trip: any
) {
  const clientDepositId = await ensureQBOAccount(qboBase, qboHeaders, "Client Deposit", "Other Current Liability", "OtherCurrentLiabilities");
  const commissionRevenueId = await ensureQBOAccount(qboBase, qboHeaders, "Commission Revenue", "Income", "ServiceFeeIncome");

  // Phase 4: Prefer agency_gross_margin (margin engine) over legacy commission_revenue
  // Fetch summed margin from bookings to get the true agency gross margin
  const { data: tripBookings } = await supabase
    .from("bookings")
    .select("agency_gross_margin, commission_revenue")
    .eq("trip_id", trip.id);

  const amount = tripBookings?.reduce(
    (sum: number, b: any) => sum + (b.agency_gross_margin || b.commission_revenue || 0),
    0
  ) || trip.total_commission_revenue || 0;

  const txnDate = new Date().toISOString().split("T")[0];
  const memo = `Revenue recognition – Trip "${trip.trip_name}" completed`;

  const journalEntry = {
    TxnDate: txnDate,
    PrivateNote: memo,
    Line: [
      {
        Amount: amount,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Debit",
          AccountRef: { value: clientDepositId, name: "Client Deposit" },
        },
        Description: memo,
      },
      {
        Amount: amount,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Credit",
          AccountRef: { value: commissionRevenueId, name: "Commission Revenue" },
        },
        Description: memo,
      },
    ],
  };

  const resp = await qboFetch(`${qboBase}/journalentry`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(journalEntry),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`QBO Trip Completed journal entry failed: ${errBody}`);
  }

  await logSync(supabase, userId, "auto-trip-completed", "success", 1, undefined, {
    amount,
    trip_id: trip.id,
    trip_name: trip.trip_name,
    accounts: { client_deposit: clientDepositId, commission_revenue: commissionRevenueId },
  });
}

/**
 * Client payment received (any trip_payment status → 'paid')
 * → Create a QBO Payment applied to the customer's open Invoice for that trip.
 *   1. Resolve client + QBO Customer
 *   2. Resolve the local invoice for this trip → qbo_invoice_id via qbo_invoice_mappings
 *      (fall back to querying QBO for an open invoice on the customer with matching DocNumber)
 *   3. POST /payment with LinkedTxn[{ TxnId, TxnType: 'Invoice' }]
 *   4. Deposit to configured bank account (or auto-detected). For deposits, the
 *      separate `handleDepositPosted` flow already books gross/fees/net via
 *      Stripe Clearing — we still create the QBO Payment so it applies to the
 *      Invoice and reduces A/R correctly.
 */
async function handleClientPaymentReceived(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, payment: any, connection?: any
) {
  const amount = Number(payment.amount) || 0;
  if (amount <= 0) {
    await logSync(supabase, userId, "auto-client-payment-received", "skipped", 0, "Zero amount");
    return;
  }

  // Idempotency: if we've already pushed this trip_payment, do nothing.
  if (payment.id) {
    const { data: existingCache } = await supabase
      .from("qbo_payments")
      .select("id, qbo_id, qbo_invoice_id")
      .eq("crm_payment_id", payment.id)
      .maybeSingle();
    if (existingCache?.qbo_id) {
      await logSync(
        supabase, userId, "auto-client-payment-received", "skipped", 0,
        "Already synced (qbo_payments cache hit)",
        { crm_payment_id: payment.id, qbo_payment_id: existingCache.qbo_id }
      );
      return;
    }
  }

  // 1. Resolve client via the trip
  let clientId: string | null = null;
  let qboCustomerId: string | null = null;
  if (payment.trip_id) {
    const { data: trip } = await supabase
      .from("trips")
      .select("client_id")
      .eq("id", payment.trip_id)
      .single();
    clientId = trip?.client_id || null;
  }

  if (clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();
    if (client) {
      qboCustomerId = await ensureQBOCustomer(supabase, qboBase, qboHeaders, userId, client);
    }
  }

  if (!qboCustomerId) {
    throw new Error("Cannot apply payment to QBO: no client/customer linked to this payment");
  }

  // 2. Resolve QBO invoice for this trip
  let qboInvoiceId: string | null = null;
  let localInvoiceId: string | null = null;

  if (payment.trip_id) {
    const { data: localInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, amount_remaining")
      .eq("trip_id", payment.trip_id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (localInvoices && localInvoices.length > 0) {
      // Prefer an invoice that still has a balance
      const target = localInvoices.find((i: any) => Number(i.amount_remaining || 0) > 0)
        || localInvoices[0];
      localInvoiceId = target.id;

      const { data: mapping } = await supabase
        .from("qbo_invoice_mappings")
        .select("qbo_invoice_id")
        .eq("user_id", userId)
        .eq("invoice_id", target.id)
        .single();

      qboInvoiceId = mapping?.qbo_invoice_id || null;

      // Fallback: search QBO for an open invoice on this customer matching DocNumber
      if (!qboInvoiceId && target.invoice_number) {
        const docNum = String(target.invoice_number).substring(0, 21).replace(/'/g, "\\'");
        const q = await fetch(
          `${qboBase}/query?query=${encodeURIComponent(
            `SELECT * FROM Invoice WHERE CustomerRef = '${qboCustomerId}' AND DocNumber = '${docNum}' MAXRESULTS 1`
          )}`,
          { headers: qboHeaders }
        );
        if (q.ok) {
          const j = await q.json();
          const inv = j?.QueryResponse?.Invoice?.[0];
          if (inv?.Id) {
            qboInvoiceId = inv.Id;
            // Persist the mapping for future payments
            await supabase.from("qbo_invoice_mappings").upsert({
              user_id: userId,
              invoice_id: target.id,
              qbo_invoice_id: inv.Id,
              last_synced_at: new Date().toISOString(),
            }, { onConflict: "user_id,invoice_id" });
          }
        }
      }
    }
  }

  // 3. Resolve deposit account
  const depositAccount = await resolvePaymentAccount(
    qboBase, qboHeaders,
    connection?.default_bank_account_id, connection?.default_bank_account_name,
    "Bank"
  );

  const txnDate = payment.payment_date || new Date().toISOString().split("T")[0];
  const piTag = payment.stripe_payment_intent_id ? ` [${payment.stripe_payment_intent_id}]` : "";
  const memo = `Client payment – ${payment.payment_type || "payment"} – ${payment.details || payment.notes || "Trip payment"}${piTag}`;

  // 4. Build QBO Payment
  const paymentData: any = {
    CustomerRef: { value: qboCustomerId },
    TotalAmt: amount,
    TxnDate: txnDate,
    DepositToAccountRef: { value: depositAccount.id, name: depositAccount.name },
    PrivateNote: memo,
  };

  if (qboInvoiceId) {
    paymentData.Line = [
      {
        Amount: amount,
        LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: "Invoice" }],
      },
    ];
  }

  const resp = await qboFetch(`${qboBase}/payment`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(paymentData),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`QBO Payment creation failed: ${errBody}`);
  }

  const result = await resp.json();
  const qboPaymentId = result?.Payment?.Id;
  const qboSyncToken = result?.Payment?.SyncToken;

  // Write local cache so future replays are idempotent and gate 7.2 closes.
  if (qboPaymentId) {
    await supabase.from("qbo_payments").upsert({
      qbo_id: String(qboPaymentId),
      qbo_customer_id: qboCustomerId,
      qbo_invoice_id: qboInvoiceId ? String(qboInvoiceId) : null,
      crm_payment_id: payment.id ?? null,
      total_amt: amount,
      txn_date: txnDate,
      payment_ref_num: payment.stripe_payment_intent_id ?? null,
      trigger_managed: true,
      sync_token: qboSyncToken ?? null,
      raw_payload: result?.Payment ?? null,
      synced_at: new Date().toISOString(),
    }, { onConflict: "qbo_id" });
  }

  await logSync(
    supabase, userId, "auto-client-payment-received", "success", 1, undefined,
    {
      amount,
      trip_id: payment.trip_id,
      payment_id: payment.id,
      payment_type: payment.payment_type,
      qbo_customer_id: qboCustomerId,
      qbo_invoice_id: qboInvoiceId,
      local_invoice_id: localInvoiceId,
      qbo_payment_id: qboPaymentId,
      applied_to_invoice: !!qboInvoiceId,
      deposit_account: depositAccount.name,
    }
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

// In-memory cache for account IDs within a single function invocation
const _accountCache = new Map<string, string>();

/**
 * Ensure a QBO Account exists by name. Creates it if missing.
 * Returns the QBO Account Id.
 *
 * @param accountType - QBO AccountType (e.g. "Other Current Asset", "Expense", "Bank")
 * @param accountSubType - QBO AccountSubType (e.g. "OtherCurrentAsset", "Expense")
 */
async function ensureQBOAccount(
  qboBase: string, qboHeaders: any,
  accountName: string, accountType: string, accountSubType: string
): Promise<string> {
  // Check cache first
  if (_accountCache.has(accountName)) {
    return _accountCache.get(accountName)!;
  }

  // Query QBO for existing account
  const nameEscaped = accountName.replace(/'/g, "\\'");
  const searchResp = await fetch(
    `${qboBase}/query?query=${encodeURIComponent(`SELECT * FROM Account WHERE Name = '${nameEscaped}'`)}`,
    { headers: qboHeaders }
  );

  if (searchResp.ok) {
    const data = await searchResp.json();
    const existing = data?.QueryResponse?.Account?.[0];
    if (existing) {
      _accountCache.set(accountName, existing.Id);
      return existing.Id;
    }
  }

  // Create the account
  const createResp = await qboFetch(`${qboBase}/account`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify({
      Name: accountName,
      AccountType: accountType,
      AccountSubType: accountSubType,
    }),
  });

  if (!createResp.ok) {
    const errText = await createResp.text();
    throw new Error(`Failed to create QBO Account "${accountName}": ${errText}`);
  }

  const result = await createResp.json();
  const id = result.Account.Id;
  _accountCache.set(accountName, id);
  console.log(`[QBO] Auto-provisioned account "${accountName}" (ID: ${id})`);
  return id;
}

/** Ensure a client exists as a QBO Customer; return QBO customer ID */
async function ensureQBOCustomer(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, client: any
): Promise<string> {
  // Check existing mapping
  const { data: mapping } = await supabase
    .from("qbo_client_mappings")
    .select("qbo_customer_id")
    .eq("user_id", userId)
    .eq("client_id", client.id)
    .single();

  if (mapping) return mapping.qbo_customer_id;

  // Check QBO by DisplayName to avoid duplicates
  const displayName = client.name || `${client.first_name || ""} ${client.last_name || ""}`.trim();
  const queryResp = await fetch(
    `${qboBase}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${displayName.replace(/'/g, "\\'")}'`)}`,
    { headers: qboHeaders }
  );

  if (queryResp.ok) {
    const queryResult = await queryResp.json();
    const existing = queryResult?.QueryResponse?.Customer?.[0];
    if (existing) {
      await supabase.from("qbo_client_mappings").insert({
        user_id: userId,
        client_id: client.id,
        qbo_customer_id: existing.Id,
      });
      return existing.Id;
    }
  }

  // Create new customer
  const customerData: any = {
    DisplayName: displayName.substring(0, 100),
    GivenName: (client.first_name || displayName.split(" ")[0] || "").substring(0, 25),
    FamilyName: (client.last_name || "").substring(0, 25),
  };
  if (client.email) customerData.PrimaryEmailAddr = { Address: client.email };
  if (client.phone) customerData.PrimaryPhone = { FreeFormNumber: client.phone };

  const createResp = await qboFetch(`${qboBase}/customer`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(customerData),
  });

  if (!createResp.ok) {
    const errBody = await createResp.text();
    throw new Error(`Failed to create QBO Customer: ${errBody}`);
  }

  const created = await createResp.json();
  const qboId = created.Customer.Id;

  await supabase.from("qbo_client_mappings").insert({
    user_id: userId,
    client_id: client.id,
    qbo_customer_id: qboId,
  });

  return qboId;
}

/** Ensure a supplier exists as a QBO Vendor; return QBO vendor ID */
async function ensureQBOVendor(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, supplier: any
): Promise<string> {
  // Check existing mapping
  const { data: mapping } = await supabase
    .from("qbo_supplier_mappings")
    .select("qbo_vendor_id")
    .eq("user_id", userId)
    .eq("supplier_id", supplier.id)
    .single();

  if (mapping) return mapping.qbo_vendor_id;

  // Check QBO by DisplayName to avoid duplicates
  const displayName = supplier.name.substring(0, 100);
  const nameEscaped = displayName.replace(/'/g, "\\'");
  const queryResp = await fetch(
    `${qboBase}/query?query=${encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName = '${nameEscaped}'`)}`,
    { headers: qboHeaders }
  );

  if (queryResp.ok) {
    const queryResult = await queryResp.json();
    const existing = queryResult?.QueryResponse?.Vendor?.[0];
    if (existing) {
      await supabase.from("qbo_supplier_mappings").insert({
        user_id: userId,
        supplier_id: supplier.id,
        qbo_vendor_id: existing.Id,
      });
      return existing.Id;
    }
  }

  // Create new vendor
  const vendorData: any = {
    DisplayName: displayName,
    CompanyName: displayName,
  };
  if (supplier.contact_email) vendorData.PrimaryEmailAddr = { Address: supplier.contact_email };
  if (supplier.contact_phone) vendorData.PrimaryPhone = { FreeFormNumber: supplier.contact_phone };
  if (supplier.website) vendorData.WebAddr = { URI: supplier.website };

  const createResp = await qboFetch(`${qboBase}/vendor`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(vendorData),
  });

  if (!createResp.ok) {
    const errBody = await createResp.text();
    throw new Error(`Failed to create QBO Vendor: ${errBody}`);
  }

  const created = await createResp.json();
  const qboId = created.Vendor.Id;

  await supabase.from("qbo_supplier_mappings").insert({
    user_id: userId,
    supplier_id: supplier.id,
    qbo_vendor_id: qboId,
  });

  console.log(`[QBO] Auto-created vendor "${displayName}" (ID: ${qboId})`);
  return qboId;
}

async function logSync(
  supabase: any, userId: string, syncType: string, status: string, recordsProcessed: number, errorMessage?: string, details?: any
) {
  await supabase.from("qbo_sync_logs").insert({
    user_id: userId,
    sync_type: syncType,
    direction: "push",
    status,
    records_processed: recordsProcessed,
    error_message: errorMessage || null,
    details: details || null,
  });
}

/**
 * Resolve a QBO payment account (Bank or Credit Card) by:
 *   1. Configured ID on qbo_connections (default_bank_account_id / default_cc_account_id)
 *   2. Configured name (looked up in QBO)
 *   3. First active account of the requested type in QBO
 *   4. Hardcoded fallback "Checking" by name (last resort, may still fail)
 */
const _payAcctCache = new Map<string, { id: string; name: string }>();

// Fetch with automatic retry on QBO 429 ThrottleExceeded.
// QBO throttle window is per-minute, so back off aggressively.
async function qboFetch(url: string, init: RequestInit, maxAttempts = 4): Promise<Response> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    const resp = await fetch(url, init);
    if (resp.status !== 429) return resp;
    // Drain body so the connection can be reused
    try { await resp.text(); } catch { /* ignore */ }
    attempt++;
    const backoffMs = Math.min(15000, 1000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
    console.warn(`[qbo-sync-trigger] QBO 429 throttled, retry ${attempt}/${maxAttempts} after ${backoffMs}ms: ${url}`);
    await new Promise((r) => setTimeout(r, backoffMs));
  }
  // All retries exhausted; throw clean error so caller doesn't try to read drained body.
  throw new Error(`QBO API throttled (429) after ${maxAttempts} attempts: ${url}`);
}

async function resolvePaymentAccount(
  qboBase: string,
  qboHeaders: any,
  configuredId: string | null | undefined,
  configuredName: string | null | undefined,
  accountType: "Bank" | "Credit Card",
): Promise<{ id: string; name: string }> {
  const cacheKey = `${accountType}:${configuredId || configuredName || "auto"}`;
  if (_payAcctCache.has(cacheKey)) return _payAcctCache.get(cacheKey)!;

  // 1. By configured ID
  if (configuredId) {
    const r = await qboFetch(`${qboBase}/account/${configuredId}`, { headers: qboHeaders });
    if (r.status === 429) {
      throw new Error(
        `QBO API throttled (429) while resolving ${accountType} account ${configuredId}. ` +
        `Retry after a short delay; do not interpret as a config issue.`
      );
    }
    if (r.ok) {
      const j = await r.json();
      const acct = j?.Account;
      if (acct) {
        const out = { id: acct.Id, name: acct.Name };
        _payAcctCache.set(cacheKey, out);
        return out;
      }
    }
  }

  // 2. By configured name
  if (configuredName) {
    const escaped = configuredName.replace(/'/g, "\\'");
    const r = await qboFetch(
      `${qboBase}/query?query=${encodeURIComponent(`SELECT * FROM Account WHERE Name = '${escaped}' AND Active = true`)}`,
      { headers: qboHeaders }
    );
    if (r.status === 429) {
      throw new Error(
        `QBO API throttled (429) while resolving ${accountType} account by name "${configuredName}". Retry later.`
      );
    }
    if (r.ok) {
      const j = await r.json();
      const acct = (j?.QueryResponse?.Account || []).find((a: any) => accountMatchesPaymentType(a, accountType));
      if (acct) {
        const out = { id: acct.Id, name: acct.Name };
        _payAcctCache.set(cacheKey, out);
        return out;
      }
    }
  }

  // 3. Auto-detect first active account of requested type
  const r = await qboFetch(
    `${qboBase}/query?query=${encodeURIComponent(`SELECT * FROM Account WHERE Active = true MAXRESULTS 200`)}`,
    { headers: qboHeaders }
  );
  if (r.status === 429) {
    throw new Error(`QBO API throttled (429) while auto-detecting ${accountType} account. Retry later.`);
  }
  if (r.ok) {
    const j = await r.json();
    const acct = (j?.QueryResponse?.Account || []).find((a: any) => accountMatchesPaymentType(a, accountType));
    if (acct) {
      const out = { id: acct.Id, name: acct.Name };
      _payAcctCache.set(cacheKey, out);
      return out;
    }
  }

  // 4. Last-resort fallback (will likely fail but preserves prior behavior)
  throw new Error(
    `No QBO ${accountType} account found. Configure a default ${accountType === "Bank" ? "bank" : "credit card"} account in Settings → Integrations → QuickBooks.`
  );
}

function accountMatchesPaymentType(account: any, accountType: "Bank" | "Credit Card") {
  const qboType = String(account?.AccountType || "").toLowerCase();
  return accountType === "Bank" ? qboType === "bank" : qboType.includes("credit");
}

// ────────────────────────────────────────────────────────────────────────────
// CRM-as-system-of-record handlers (CRM → QBO push, no reverse path)
// ────────────────────────────────────────────────────────────────────────────

/** Resolve a QBO account ID by role from qbo_account_mappings (admin-configured). */
async function getMappedAccountId(supabase: any, role: string): Promise<string> {
  const { data, error } = await supabase
    .from("qbo_account_mappings")
    .select("qbo_account_id")
    .eq("role", role)
    .maybeSingle();
  if (error) throw new Error(`qbo_account_mappings lookup failed (${role}): ${error.message}`);
  if (!data?.qbo_account_id) {
    throw new Error(
      `No QBO account mapped for role "${role}". Configure in Settings → QuickBooks → Account Mapping.`
    );
  }
  return data.qbo_account_id;
}

/** New CRM client → QBO Customer (idempotent via qbo_client_mappings). */
async function handleClientCreated(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, client: any,
) {
  await ensureQBOCustomer(supabase, qboBase, qboHeaders, userId, client);
  await logSync(supabase, userId, "auto-client-created", "success", 1, undefined, { client_id: client.id });
}

/** New CRM supplier → QBO Vendor (idempotent via qbo_supplier_mappings). */
async function handleSupplierCreated(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, supplier: any,
) {
  await ensureQBOVendor(supabase, qboBase, qboHeaders, userId, supplier);
  await logSync(supabase, userId, "auto-supplier-created", "success", 1, undefined, { supplier_id: supplier.id });
}

/**
 * Loan installment paid → linked pair of QBO Bank Deposits (cash basis).
 *   - Principal Deposit  → Loan Principal Clearing, source line credits Loan Receivable
 *   - Interest  Deposit  → Loan Interest  Clearing, source line credits Interest Income
 * Both deposits share an idempotency key derived from (loan_application_id, payment_number).
 * If either POST fails, the partial state is logged and surfaced for retry — no half-posted installments.
 */
async function handleLoanRepaymentPosted(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, schedule: any,
) {
  const principal = Number(schedule.principal_amount || 0);
  const interest = Number(schedule.interest_amount || 0);
  if (principal <= 0 && interest <= 0) {
    await logSync(supabase, userId, "auto-loan-repayment", "skipped", 0, "Zero principal and interest");
    return;
  }

  const idemKey = `loan_repayment:${schedule.id}`;

  // Idempotency: if we already posted a successful pair for this schedule, skip.
  const { data: prior } = await supabase
    .from("qbo_sync_logs")
    .select("id, status")
    .eq("idempotency_key", idemKey)
    .eq("status", "success")
    .maybeSingle();
  if (prior) {
    console.log(`[loan_repayment_posted] already posted for schedule ${schedule.id}; skipping`);
    return;
  }

  const [principalAcct, interestAcct, loanReceivableAcct, interestIncomeAcct] = await Promise.all([
    getMappedAccountId(supabase, "loan_principal_clearing"),
    getMappedAccountId(supabase, "loan_interest_clearing"),
    getMappedAccountId(supabase, "loan_receivable"),
    getMappedAccountId(supabase, "interest_income"),
  ]);

  // Resolve loan application for memo/customer linkage.
  const { data: loan } = await supabase
    .from("loan_applications")
    .select("id, application_number, first_name, last_name, email")
    .eq("id", schedule.loan_application_id)
    .maybeSingle();

  const memo = `Loan ${loan?.application_number || schedule.loan_application_id} • Installment ${schedule.payment_number}`;
  const txnDate = (schedule.paid_date || new Date().toISOString()).split("T")[0];

  const buildDeposit = (depositAccountId: string, sourceAccountId: string, amount: number) => ({
    DepositToAccountRef: { value: depositAccountId },
    TxnDate: txnDate,
    PrivateNote: memo,
    Line: [
      {
        Amount: Number(amount.toFixed(2)),
        DetailType: "DepositLineDetail",
        Description: memo,
        DepositLineDetail: {
          AccountRef: { value: sourceAccountId },
        },
      },
    ],
  });

  let principalDepositId: string | null = schedule.qbo_principal_deposit_id || null;
  let interestDepositId: string | null = schedule.qbo_interest_deposit_id || null;

  try {
    if (principal > 0 && !principalDepositId) {
      const r = await qboFetch(`${qboBase}/deposit`, {
        method: "POST",
        headers: qboHeaders,
        body: JSON.stringify(buildDeposit(principalAcct, loanReceivableAcct, principal)),
      });
      if (!r.ok) throw new Error(`Principal Deposit failed: ${await r.text()}`);
      const j = await r.json();
      principalDepositId = j?.Deposit?.Id || null;
    }

    if (interest > 0 && !interestDepositId) {
      const r = await qboFetch(`${qboBase}/deposit`, {
        method: "POST",
        headers: qboHeaders,
        body: JSON.stringify(buildDeposit(interestAcct, interestIncomeAcct, interest)),
      });
      if (!r.ok) throw new Error(`Interest Deposit failed: ${await r.text()}`);
      const j = await r.json();
      interestDepositId = j?.Deposit?.Id || null;
    }

    await supabase
      .from("loan_payment_schedules")
      .update({
        qbo_principal_deposit_id: principalDepositId,
        qbo_interest_deposit_id: interestDepositId,
        qbo_synced_at: new Date().toISOString(),
      })
      .eq("id", schedule.id);

    await supabase.from("qbo_sync_logs").insert({
      user_id: userId,
      sync_type: "auto-loan-repayment",
      direction: "push",
      status: "success",
      records_processed: (principal > 0 ? 1 : 0) + (interest > 0 ? 1 : 0),
      idempotency_key: idemKey,
      details: {
        loan_application_id: schedule.loan_application_id,
        payment_number: schedule.payment_number,
        principal_deposit_id: principalDepositId,
        interest_deposit_id: interestDepositId,
        principal_amount: principal,
        interest_amount: interest,
      },
    });
  } catch (err: any) {
    // Persist whatever DepositId we got so a retry doesn't double-post.
    await supabase
      .from("loan_payment_schedules")
      .update({
        qbo_principal_deposit_id: principalDepositId,
        qbo_interest_deposit_id: interestDepositId,
      })
      .eq("id", schedule.id);

    await supabase.from("qbo_sync_logs").insert({
      user_id: userId,
      sync_type: "auto-loan-repayment",
      direction: "push",
      status: principalDepositId || interestDepositId ? "pending_rollback" : "error",
      records_processed: (principalDepositId ? 1 : 0) + (interestDepositId ? 1 : 0),
      error_message: err.message,
      idempotency_key: idemKey,
      details: {
        loan_application_id: schedule.loan_application_id,
        payment_number: schedule.payment_number,
        principal_deposit_id: principalDepositId,
        interest_deposit_id: interestDepositId,
      },
    });
    throw err;
  }
}

/**
 * Backfill: apply an existing QBO Payment to a QBO Invoice via sparse update.
 * record = { user_id, qbo_payment_id, qbo_invoice_id }
 */
async function handleApplyPaymentToInvoice(
  supabase: any, qboBase: string, qboHeaders: any, userId: string, record: any
) {
  const qboPaymentId = String(record.qbo_payment_id ?? "");
  const qboInvoiceId = String(record.qbo_invoice_id ?? "");
  if (!qboPaymentId || !qboInvoiceId) {
    throw new Error("apply_payment_to_invoice: missing qbo_payment_id or qbo_invoice_id");
  }

  // Fetch existing Payment (sync token + customer ref + total)
  const getR = await qboFetch(`${qboBase}/payment/${qboPaymentId}`, { headers: qboHeaders });
  if (!getR.ok) {
    throw new Error(`Fetch QBO Payment ${qboPaymentId} failed: ${await getR.text()}`);
  }
  const payment = (await getR.json())?.Payment;
  if (!payment) throw new Error(`QBO Payment ${qboPaymentId} not in response`);

  // If already linked to this invoice, no-op.
  const already = (payment.Line || []).some((l: any) =>
    (l.LinkedTxn || []).some((lt: any) => String(lt.TxnId) === qboInvoiceId && lt.TxnType === "Invoice")
  );
  if (already) {
    await supabase.from("qbo_payments")
      .update({ qbo_invoice_id: qboInvoiceId, synced_at: new Date().toISOString() })
      .eq("qbo_id", qboPaymentId);
    await logSync(supabase, userId, "auto-apply-payment-to-invoice", "success", 1, undefined, {
      qbo_payment_id: qboPaymentId, qbo_invoice_id: qboInvoiceId, noop: true,
    });
    return;
  }

  const sparseBody = {
    Id: payment.Id,
    SyncToken: payment.SyncToken,
    sparse: true,
    CustomerRef: payment.CustomerRef,
    TotalAmt: payment.TotalAmt,
    Line: [{
      Amount: payment.TotalAmt,
      LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: "Invoice" }],
    }],
  };

  const upR = await qboFetch(`${qboBase}/payment?operation=update`, {
    method: "POST",
    headers: qboHeaders,
    body: JSON.stringify(sparseBody),
  });
  if (!upR.ok) {
    throw new Error(`Apply Payment ${qboPaymentId} → Invoice ${qboInvoiceId} failed: ${await upR.text()}`);
  }

  await supabase.from("qbo_payments")
    .update({ qbo_invoice_id: qboInvoiceId, synced_at: new Date().toISOString() })
    .eq("qbo_id", qboPaymentId);

  await logSync(supabase, userId, "auto-apply-payment-to-invoice", "success", 1, undefined, {
    qbo_payment_id: qboPaymentId, qbo_invoice_id: qboInvoiceId,
  });
}
