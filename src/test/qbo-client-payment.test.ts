import { describe, it, expect } from "vitest";
import { isRealClientPayment, paymentRequestId } from "../../supabase/functions/_shared/qbo-payment-rules";

describe("automatic QuickBooks client payments", () => {
  it("accepts real paid receipts including newly inserted group deposits", () => {
    expect(isRealClientPayment({ status: "paid", amount: 491.53, payment_date: "2026-10-03", payment_type: "deposit", payment_method: "credit_card" })).toBe(true);
  });
  it("does not post unpaid installments", () => {
    expect(isRealClientPayment({ status: "pending", amount: 514.67, payment_date: "2026-10-03" })).toBe(false);
  });
  it("does not treat cancelled schedule rows marked paid as cash receipts", () => {
    expect(isRealClientPayment({ status: "paid", amount: 514.67, payment_date: "2026-10-03", due_date: "2026-10-03", payment_type: "installment" })).toBe(false);
  });
  it("uses the same QuickBooks request identity on every retry", () => {
    expect(paymentRequestId("62d71977-261b-4358-a497-96aa9e1a532a")).toBe("cp-62d71977-261b-4358-a497-96aa9e1a532a");
    expect(paymentRequestId("62d71977-261b-4358-a497-96aa9e1a532a").length).toBeLessThanOrEqual(50);
  });
});