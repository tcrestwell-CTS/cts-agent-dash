type QboRow = {
  group?: string;
  Summary?: { ColData?: Array<{ value?: string }> };
};

export type ProfitLossMonth = { income: number; expense: number; net: number };

export function parseQboProfitLoss(report: {
  Header?: { ReportName?: string };
  Rows?: { Row?: QboRow[] };
}): ProfitLossMonth {
  if (report?.Header?.ReportName !== "ProfitAndLoss") {
    throw new Error("QuickBooks did not return a Profit & Loss report.");
  }
  const rows = report.Rows?.Row ?? [];
  const total = (group: string) => {
    const raw = rows.find((row) => row.group === group)?.Summary?.ColData?.[1]?.value;
    if (!raw) return 0;
    const value = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(value)) throw new Error("QuickBooks returned an invalid report amount.");
    return value;
  };
  return {
    income: total("Income") + total("OtherIncome"),
    expense: total("COGS") + total("Expenses") + total("OtherExpenses"),
    net: total("NetIncome"),
  };
}