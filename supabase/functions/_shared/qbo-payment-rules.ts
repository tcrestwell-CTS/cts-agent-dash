/**
 * Shared client-receipt, refund, invoice, and supplier-bill rules.
 * The database function is_invoice_cash_payment mirrors isSchedulePlaceholder
 * and isRealClientPayment — keep the two in sync.
 */

const TENDER =
  /\b(cash|check|cheque|zelle|venmo|wire|ach|paypal|cashapp|money\s*order|bank\s*transfer|cash\s*app)\b/i;

/** Scheduler rows: "Installment 2 of 6". */
const SCHEDULE_DETAILS = /^installment\s+\d+/i;

/** Adjusted plan rows, e.g. "Final balance (adjusted — paid in full Oct 2026)". */
const ADJUSTED_FINAL = /^final balance\s*(\(|$)/i;

export const CLIENT_FUNDS_MAPPING_ROLE = "client_funds";
export const CLIENT_FUNDS_PARENT = "Client Funds";
export const CLIENT_FUNDS_SUBACCOUNT = "Client Deposit";
export const CLIENT_FUNDS_QUALIFIED = "Client Funds:Client Deposit";
export const COVERED_INSTALLMENT_STATUS = "applied";

export type ClientPaymentShape = {
  status?: string | null;
  amount?: number | string | null;
  refunded_amount?: number | string | null;
  payment_date?: string | null;
  due_date?: string | null;
  payment_method?: string | null;
  stripe_session_id?: string | null;
  stripe_receipt_url?: string | null;
  stripe_payment_intent_id?: string | null;
  payment_type?: string | null;
  details?: string | null;
  notes?: string | null;
};

export type QboAccountChoice = {
  id: string;
  name?: string | null;
  fullyQualifiedName?: string | null;
  active?: boolean | null;
  subAccount?: boolean | null;
  parentId?: string | null;
};

export type TripInvoiceCandidate = {
  id: string;
  docNumber?: string | null;
  privateNote?: string | null;
  description?: string | null;
  customerId?: string | null;
};

function money(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function hasReceiptEvidence(payment: ClientPaymentShape): boolean {
  const method = (payment.payment_method ?? "").trim().toLowerCase();
  if (method && method !== "none") return true;
  if (payment.stripe_session_id || payment.stripe_receipt_url || payment.stripe_payment_intent_id) return true;
  return TENDER.test(`${payment.details ?? ""} ${payment.notes ?? ""}`);
}

/**
 * A schedule placeholder is a plan row that was flagged paid without a receipt.
 * Hand-logged cash, check, and Zelle stay receipts even when the method was
 * left blank. Generated "Installment N of M" rows do not.
 */
export function isSchedulePlaceholder(payment: ClientPaymentShape): boolean {
  if (!payment.due_date || hasReceiptEvidence(payment)) return false;
  const type = payment.payment_type ?? "";
  if (type === "installment" || type === "final") return true;
  const details = payment.details ?? "";
  return SCHEDULE_DETAILS.test(details) || ADJUSTED_FINAL.test(details);
}

export function netReceiptAmount(payment: ClientPaymentShape): number {
  return money(money(payment.amount) - money(payment.refunded_amount));
}

export function isRealClientPayment(payment: ClientPaymentShape): boolean {
  return payment.status === "paid" &&
    Boolean(payment.payment_date) &&
    netReceiptAmount(payment) > 0 &&
    !isSchedulePlaceholder(payment);
}

/** Why a paid row was not posted. Null when the row is a real receipt or not paid. */
export function paymentSkipReason(payment: ClientPaymentShape): string | null {
  if (payment.status === "refunded") return "Refunded, so it is not posted as client funds received.";
  if (payment.status !== "paid") return null;
  if (!(money(payment.amount) > 0)) return "Amount is zero.";
  if (!payment.payment_date) return "Paid row has no payment date.";
  if (netReceiptAmount(payment) <= 0) return "Fully refunded.";
  if (isSchedulePlaceholder(payment)) {
    return "Scheduled installment with no cash, check, Zelle, or Stripe receipt. It was not posted to QuickBooks.";
  }
  return null;
}

export function paymentRequestId(id: string) {
  return `cp-${id}`;
}

export function invoiceRequestId(tripId: string) {
  return `inv${tripId.replace(/-/g, "")}`.slice(0, 50);
}

export function refundRequestId(paymentId: string, refundedCents: number) {
  return `rf${paymentId.replace(/-/g, "")}${refundedCents}`.slice(0, 50);
}

export function supplierBillRequestId(bookingId: string) {
  return `sb${bookingId.replace(/-/g, "")}`.slice(0, 50);
}

export function supplierPaymentRequestId(bookingId: string, paidCents: number) {
  return `sp${bookingId.replace(/-/g, "")}${paidCents}`.slice(0, 50);
}

export function tripInvoiceTag(tripId: string) {
  return `trip:${tripId}`;
}

/**
 * Reuse a QuickBooks invoice already opened for this trip and customer.
 * A matching DocNumber on another customer is not this trip's invoice.
 */
export function selectTripInvoiceId(
  candidates: TripInvoiceCandidate[],
  wanted: { customerId: string; tripId: string; docNumber?: string | null; confirmation?: string | null },
): string | null {
  const sameCustomer = candidates.filter((c) =>
    !c.customerId || String(c.customerId) === String(wanted.customerId));
  const tag = tripInvoiceTag(wanted.tripId);
  const tagged = sameCustomer.find((c) => (c.privateNote ?? "").includes(tag));
  if (tagged) return tagged.id;
  if (wanted.docNumber) {
    const prefix = wanted.docNumber.substring(0, 15);
    const doc = sameCustomer.find((c) =>
      c.docNumber === wanted.docNumber ||
      (prefix.length > 0 && String(c.docNumber ?? "").startsWith(`${prefix}-`)));
    if (doc) return doc.id;
  }
  const confirmation = (wanted.confirmation ?? "").trim();
  if (confirmation) {
    const described = sameCustomer.find((c) => (c.description ?? "").includes(confirmation));
    if (described) return described.id;
  }
  return null;
}

/**
 * Prefer the mapped account, then the existing Client Funds:Client Deposit
 * sub-account. Never pick the parent Client Funds account while that
 * sub-account exists.
 */
export function pickClientFundsAccount(
  accounts: QboAccountChoice[],
  mappedId?: string | null,
): { id: string; name: string } | null {
  const active = accounts.filter((a) => a.active !== false);
  if (mappedId) {
    const mapped = active.find((a) => String(a.id) === String(mappedId)) ?? accounts.find((a) => String(a.id) === String(mappedId));
    if (mapped) return { id: mapped.id, name: mapped.fullyQualifiedName || mapped.name || CLIENT_FUNDS_QUALIFIED };
  }
  const qualified = active.find((a) => a.fullyQualifiedName === CLIENT_FUNDS_QUALIFIED);
  if (qualified) return { id: qualified.id, name: qualified.fullyQualifiedName || CLIENT_FUNDS_QUALIFIED };
  const parent = active.find((a) => a.name === CLIENT_FUNDS_PARENT && !a.subAccount);
  const sub = active.find((a) =>
    a.name === CLIENT_FUNDS_SUBACCOUNT &&
    !!parent &&
    String(a.parentId ?? "") === String(parent.id));
  if (sub) return { id: sub.id, name: sub.fullyQualifiedName || CLIENT_FUNDS_QUALIFIED };
  return null;
}

export type SupplierSettlementInput = {
  supplier_paid_amount?: number | string | null;
  supplier_payout?: number | string | null;
  supplier_paid_status?: string | null;
};

/** Bill the supplier cost. A paid row with a blank amount settles the payout. */
export function supplierSettlement(booking: SupplierSettlementInput): { billTotal: number; payAmount: number } {
  const payout = money(booking.supplier_payout);
  const recorded = money(booking.supplier_paid_amount);
  const status = booking.supplier_paid_status ?? "";
  const payAmount = recorded > 0 ? recorded : (status === "paid" && payout > 0 ? payout : 0);
  const billTotal = payout > 0 ? Math.max(payout, payAmount) : payAmount;
  return { billTotal: money(billTotal), payAmount: money(payAmount) };
}

export type InstallmentPlanRow = { id: string; amount: number | string | null };
export type InstallmentUpdate = {
  id: string;
  status?: string;
  amount?: number;
  payment_date?: string;
};

/**
 * Cover pending installments from one receipt. Fully covered rows become
 * "applied" so the receipt is the only cash row. The source receipt is not
 * in this list and is left unchanged.
 */
export function planInstallmentApplication(
  installments: InstallmentPlanRow[],
  amount: number,
  paymentDate: string,
): { updates: InstallmentUpdate[]; markedPaid: number; reducedRemainder: number } {
  let remaining = money(amount);
  const updates: InstallmentUpdate[] = [];
  let markedPaid = 0;
  let reducedRemainder = 0;
  if (remaining <= 0) return { updates, markedPaid, reducedRemainder };

  for (const inst of installments) {
    if (remaining <= 0.0049) break;
    const instAmt = money(inst.amount);
    if (instAmt <= 0) continue;
    if (remaining + 0.0049 >= instAmt) {
      updates.push({
        id: inst.id,
        status: COVERED_INSTALLMENT_STATUS,
        payment_date: paymentDate,
      });
      remaining = money(remaining - instAmt);
      markedPaid += 1;
    } else {
      updates.push({ id: inst.id, amount: money(instAmt - remaining) });
      reducedRemainder = remaining;
      remaining = 0;
      break;
    }
  }
  return { updates, markedPaid, reducedRemainder };
}

/** Find an existing QBO invoice for this customer whose DocNumber is one of the
 *  trip's invoice numbers or an advisor-suffixed variant of it. */
export function pickExistingInvoice(
  found: Array<{ Id?: string; DocNumber?: string; CustomerRef?: { value?: string } }>,
  customerId: string, docNumbers: string[],
): string | null {
  const hit = found.find((i) => String(i?.CustomerRef?.value) === String(customerId) &&
    docNumbers.some((d) => i.DocNumber === d || String(i.DocNumber ?? "").startsWith(`${d.substring(0, 15)}-`)));
  return hit?.Id ? String(hit.Id) : null;
}
