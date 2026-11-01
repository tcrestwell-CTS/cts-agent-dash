import { describe, it, expect } from "vitest";
import {
  isRealClientPayment,
  paymentRequestId,
  paymentSkipReason,
  refundRequestId,
  invoiceRequestId,
  selectTripInvoiceId,
  pickExistingInvoice,
  pickClientFundsAccount,
  supplierSettlement,
  planInstallmentApplication,
  COVERED_INSTALLMENT_STATUS,
} from "../../supabase/functions/_shared/qbo-payment-rules";

describe("automatic QuickBooks client payments", () => {
  it("accepts real paid receipts including newly inserted group deposits", () => {
    expect(isRealClientPayment({ status: "paid", amount: 491.53, payment_date: "2026-10-03", payment_type: "deposit", payment_method: "credit_card" })).toBe(true);
  });
  it("does not post unpaid installments", () => {
    expect(isRealClientPayment({ status: "pending", amount: 514.67, payment_date: "2026-10-03" })).toBe(false);
  });
  it("posts a paid receipt that has a date even when no method was stored", () => {
    expect(isRealClientPayment({ status: "paid", amount: 514.67, payment_date: "2026-10-03" })).toBe(true);
  });
  it("does not treat cancelled schedule rows marked paid as cash receipts", () => {
    expect(isRealClientPayment({ status: "paid", amount: 514.67, payment_date: "2026-10-03", due_date: "2026-10-03", payment_type: "installment" })).toBe(false);
    expect(paymentSkipReason({ status: "paid", amount: 514.67, payment_date: "2026-10-03", due_date: "2026-10-03", payment_type: "installment" }))
      .toMatch(/Scheduled installment/);
  });
  it("posts hand-logged cash, check, and Zelle even without a payment method or Stripe receipt", () => {
    expect(isRealClientPayment({
      status: "paid", amount: 800, payment_date: "2026-10-30", due_date: "2026-11-01",
      payment_type: "final_balance", payment_method: null, details: "Paid by check #1042",
    })).toBe(true);
    expect(isRealClientPayment({
      status: "paid", amount: 250, payment_date: "2026-10-30", due_date: "2026-10-30",
      payment_type: "payment", notes: "Zelle from the client",
    })).toBe(true);
    expect(isRealClientPayment({
      status: "paid", amount: 400, payment_date: "2026-10-30", due_date: "2026-10-30",
      payment_type: "final_balance", details: "",
    })).toBe(true);
    expect(isRealClientPayment({
      status: "paid", amount: 100, payment_date: "2026-10-30", due_date: "2026-10-30",
      payment_type: "installment", notes: "cash at the office",
    })).toBe(true);
  });
  it("still skips a generated installment that was only flagged paid", () => {
    expect(isRealClientPayment({
      status: "paid", amount: 315.26, payment_date: "2026-10-03", due_date: "2026-10-03",
      payment_type: "final_balance", details: "Installment 3 of 3",
    })).toBe(false);
    expect(isRealClientPayment({
      status: "paid", amount: 315.27, payment_date: "2026-10-03", due_date: "2026-10-03",
      payment_type: "payment", details: "Final balance (adjusted — paid in full Oct 2026)",
    })).toBe(false);
  });
  it("reuses this customer's existing or suffixed invoice instead of creating another", () => {
    const found = [{ Id: "9", DocNumber: "INV-2026-00124", CustomerRef: { value: "77" } },
      { Id: "12", DocNumber: "INV-2026-00130-abcde", CustomerRef: { value: "55" } }];
    expect(pickExistingInvoice(found, "55", ["INV-2026-00130"])).toBe("12");
    expect(pickExistingInvoice(found, "55", ["INV-2026-00124"])).toBe(null);
  });
  it("uses the same QuickBooks request identity on every retry", () => {
    const id = "62d71977-261b-4358-a497-96aa9e1a532a";
    expect(paymentRequestId(id)).toBe(`cp-${id}`);
    expect(paymentRequestId(id).length).toBeLessThanOrEqual(50);
    expect(invoiceRequestId(id).length).toBeLessThanOrEqual(50);
    expect(refundRequestId(id, 49153).length).toBeLessThanOrEqual(50);
    expect(refundRequestId(id, 49153)).toBe(refundRequestId(id, 49153));
  });
});

describe("one QuickBooks invoice per trip", () => {
  const customer = "88";
  const tripId = "11111111-1111-1111-1111-111111111111";
  it("reuses the invoice already tagged for the trip", () => {
    expect(selectTripInvoiceId([
      { id: "9", docNumber: "INV-9", customerId: customer, privateNote: `trip:${tripId}` },
      { id: "10", docNumber: "INV-2026-00124", customerId: "other" },
    ], { customerId: customer, tripId, docNumber: "INV-2026-00124" })).toBe("9");
  });
  it("does not adopt another advisor's invoice that happens to share the number", () => {
    expect(selectTripInvoiceId([
      { id: "10", docNumber: "INV-2026-00124", customerId: "other", description: "Booking ABC" },
    ], { customerId: customer, tripId, docNumber: "INV-2026-00124", confirmation: "ABC" })).toBeNull();
  });
  it("adopts the same customer's invoice with this booking confirmation", () => {
    expect(selectTripInvoiceId([
      { id: "11", docNumber: "INV-OTHER", customerId: customer, description: "Booking CONF-44 — Hawaii" },
    ], { customerId: customer, tripId, docNumber: "INV-2026-00124", confirmation: "CONF-44" })).toBe("11");
  });
});

describe("client funds account", () => {
  it("posts to Client Funds:Client Deposit instead of the parent", () => {
    const picked = pickClientFundsAccount([
      { id: "1", name: "Client Funds", fullyQualifiedName: "Client Funds", subAccount: false, active: true },
      { id: "2", name: "Client Deposit", fullyQualifiedName: "Client Funds:Client Deposit", subAccount: true, parentId: "1", active: true },
    ]);
    expect(picked).toEqual({ id: "2", name: "Client Funds:Client Deposit" });
  });
  it("uses the mapped account when one is configured", () => {
    expect(pickClientFundsAccount([
      { id: "2", name: "Client Deposit", fullyQualifiedName: "Client Funds:Client Deposit", active: true },
      { id: "9", name: "Trust", fullyQualifiedName: "Trust", active: true },
    ], "9")).toEqual({ id: "9", name: "Trust" });
  });
});

describe("supplier bill settlement", () => {
  it("uses supplier payout when a paid booking has a blank amount", () => {
    expect(supplierSettlement({ supplier_paid_status: "paid", supplier_paid_amount: 0, supplier_payout: 1004.76 }))
      .toEqual({ billTotal: 1004.76, payAmount: 1004.76 });
  });
  it("pays only the recorded partial and still bills the full payout", () => {
    expect(supplierSettlement({ supplier_paid_status: "partial", supplier_paid_amount: 400, supplier_payout: 1000 }))
      .toEqual({ billTotal: 1000, payAmount: 400 });
  });
  it("does not invent a payment for an unpaid booking", () => {
    expect(supplierSettlement({ supplier_paid_status: "unpaid", supplier_paid_amount: null, supplier_payout: 1000 }).payAmount).toBe(0);
  });
});

describe("installment allocation", () => {
  it("covers installments without leaving a second paid receipt", () => {
    const plan = planInstallmentApplication([
      { id: "a", amount: 200 },
      { id: "b", amount: 200 },
      { id: "c", amount: 150 },
    ], 450, "2026-10-30");
    expect(plan.markedPaid).toBe(2);
    expect(plan.reducedRemainder).toBe(50);
    expect(plan.updates.map((u) => u.status)).toEqual([COVERED_INSTALLMENT_STATUS, COVERED_INSTALLMENT_STATUS, undefined]);
    expect(plan.updates[2]).toEqual({ id: "c", amount: 100 });
    expect(plan.updates.every((u) => u.status !== "paid")).toBe(true);
  });
});