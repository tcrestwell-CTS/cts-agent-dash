import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildPaymentSchedule, finalPaymentDate } from "@/lib/groupPaymentSchedule";

describe("group payment schedule", () => {
  it("sets the final payment 30 days before the trip", () => {
    expect(finalPaymentDate("2027-05-20")).toBe("2027-04-20");
  });
  it("spreads the balance in equal monthly payments ending on the final date", () => {
    const s = buildPaymentSchedule(1752.34, 600, "2027-05-20", "2026-11-16", "monthly");
    expect(s[0]).toEqual({ payment_type: "deposit", amount: 600, due_date: "2026-11-16" });
    const rest = s.slice(1);
    expect(rest.length).toBe(5);
    expect(rest[rest.length - 1].due_date).toBe("2027-04-20");
    expect(rest[0].due_date).toBe("2026-12-16");
    expect(rest.slice(0, 4).every((p) => p.amount === 230.46)).toBe(true);
    expect(Math.round(rest.reduce((a, p) => a + p.amount, 0) * 100) / 100).toBe(1152.34);
  });
  it("uses one balance payment when the trip is too close for monthly payments", () => {
    const s = buildPaymentSchedule(1752.34, 600, "2027-05-20", "2027-03-01", "monthly");
    expect(s.slice(1)).toEqual([{ payment_type: "final_balance", amount: 1152.34, due_date: "2027-04-20" }]);
  });
  it("leaves one financed balance item for Flexpay or Affirm", () => {
    const s = buildPaymentSchedule(1752.34, 600, "2027-05-20", "2026-11-16", "affirm");
    expect(s.length).toBe(2);
    expect(s[1].amount).toBe(1152.34);
  });
  it("server copy matches the app copy", () => {
    const a = readFileSync(resolve(__dirname, "../lib/groupPaymentSchedule.ts"), "utf8");
    const b = readFileSync(resolve(__dirname, "../../supabase/functions/_shared/group-payment-schedule.ts"), "utf8");
    expect(b).toBe(a);
  });
});
