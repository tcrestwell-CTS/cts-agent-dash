import { describe, expect, it } from "vitest";
import { parseQboProfitLoss } from "@/lib/qboProfitLoss";

const report = (groups: Record<string, string>) => ({
  Header: { ReportName: "ProfitAndLoss" },
  Rows: { Row: Object.entries(groups).map(([group, value]) => ({
    group, Summary: { ColData: [{ value: group }, { value }] },
  })) },
});

describe("QuickBooks-backed agency P&L", () => {
  it("uses QuickBooks October totals including advisor costs, not client cash flow", () => {
    expect(parseQboProfitLoss(report({ Income: "562.76", COGS: "123.80", Expenses: "200.00", NetIncome: "238.96" })))
      .toEqual({ income: 562.76, expense: 323.8, net: 238.96 });
  });
  it("includes other income and other expenses", () => {
    expect(parseQboProfitLoss(report({ Income: "100", OtherIncome: "20", Expenses: "40", OtherExpenses: "5", NetIncome: "75" })))
      .toEqual({ income: 120, expense: 45, net: 75 });
  });
  it("does not convert a failed report into zero profit", () => {
    expect(() => parseQboProfitLoss({})).toThrow();
  });
});