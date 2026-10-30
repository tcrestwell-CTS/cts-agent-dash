import { describe, it, expect } from "vitest";
import { isRealClientPayment, paymentRequestId, pickExistingInvoice } from "../../supabase/functions/_shared/qbo-payment-rules";

describe("automatic QuickBooks client payments", () => {
  it("accepts real paid receipts including newly inserted group deposits", () => {
    expect(isRealClientPayment({ status: "paid", amount: 491.53, payment_date: "2026-10-03", payment_type: "deposit", payment_method: "credit_card" })).toBe(true);
  });
  it("does not post unpaid installments", () => {
    expect(isRealClientPayment({ status: "pending", amount: 514.67, payment_date: "2026-10-03" })).toBe(false);
  });
  it("posts cash/check installments marked paid with no payment method", () => {
    expect(isRealClientPayment({ status: "paid", amount: 514.67, payment_date: "2026-10-03" })).toBe(true);
  });
  it("reuses this customer's existing (or suffixed) invoice instead of creating another", () => {
    const found = [{ Id: "9", DocNumber: "INV-2026-00124", CustomerRef: { value: "77" } },
      { Id: "12", DocNumber: "INV-2026-00130-abcde", CustomerRef: { value: "55" } }];
    expect(pickExistingInvoice(found, "55", ["INV-2026-00130"])).toBe("12");
    expect(pickExistingInvoice(found, "55", ["INV-2026-00124"])).toBe(null);
  });
  it("uses the same QuickBooks request identity on every retry", () => {
    expect(paymentRequestId("62d71977-261b-4358-a497-96aa9e1a532a")).toBe("cp-62d71977-261b-4358-a497-96aa9e1a532a");
    expect(paymentRequestId("62d71977-261b-4358-a497-96aa9e1a532a").length).toBeLessThanOrEqual(50);
  });
});