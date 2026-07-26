import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { PeriodLockButton } from "@/components/bookkeeper/PeriodLockButton";
import { BookkeeperBreadcrumb, TableSkeleton, MoneyCell } from "@/components/bookkeeper/shared";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { KPITile } from "@/components/patterns/KPITile";

const fmt = (n: number) =>
  Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

function yearRange(y: number) {
  return {
    start: `${y}-01-01`,
    end: `${y + 1}-01-01`,
  };
}

function usePLData(year: number) {
  return useQuery({
    queryKey: ["bookkeeper-pl", year],
    queryFn: async () => {
      const { start, end } = yearRange(year);
      const [incRes, expRes] = await Promise.all([
        (supabase as any)
          .from("trip_payments")
          .select("amount, payment_date")
          .eq("status", "paid")
          .gte("payment_date", start)
          .lt("payment_date", end),
        (supabase as any)
          .from("bookings")
          .select("supplier_paid_amount, supplier_paid_date")
          .eq("supplier_paid_status", "paid")
          .gte("supplier_paid_date", start)
          .lt("supplier_paid_date", end),
      ]);
      const months = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
      for (const r of incRes.data ?? []) {
        const m = new Date(r.payment_date + "T00:00:00").getMonth();
        months[m].income += Number(r.amount || 0);
      }
      for (const r of expRes.data ?? []) {
        if (!r.supplier_paid_date) continue;
        const m = new Date(r.supplier_paid_date + "T00:00:00").getMonth();
        months[m].expense += Number(r.supplier_paid_amount || 0);
      }
      return months;
    },
  });
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function BookkeeperPL() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = usePLData(year);
  const logAction = useLogBookkeeperAction();
  useEffect(() => { logAction("view", "bookkeeper_pl", { year }); }, [logAction, year]);

  const totals = useMemo(() => {
    const income = (data ?? []).reduce((s, m) => s + m.income, 0);
    const expense = (data ?? []).reduce((s, m) => s + m.expense, 0);
    return { income, expense, net: income - expense };
  }, [data]);

  const years = [year + 1, year, year - 1, year - 2];

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_pl", { year });
    exportToCSV(
      (data ?? []).map((row, i) => ({
        month: MONTHS[i],
        year,
        income: row.income.toFixed(2),
        expense: row.expense.toFixed(2),
        net: (row.income - row.expense).toFixed(2),
      })),
      `bookkeeper-pl-${year}`,
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="space-y-2">
          <BookkeeperBreadcrumb page="P&L" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Profit & Loss</h1>
                <PeriodLockButton year={year} month={new Date().getMonth() + 1} />
              </div>
              <p className="text-[13.5px] text-muted-foreground">
                Cash-basis income minus supplier expenses by month.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-32 text-[13.5px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !(data?.length)} className="text-[13px]">
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
          <KPITile
            label="Total Income"
            value={isLoading ? <Skeleton className="h-[26px] w-24" /> : fmt(totals.income)}
          />
          <KPITile
            label="Total Expenses"
            value={isLoading ? <Skeleton className="h-[26px] w-24" /> : fmt(totals.expense)}
          />
          <KPITile
            label="Net Income"
            value={
              isLoading ? (
                <Skeleton className="h-[26px] w-24" />
              ) : (
                <span className={totals.net < 0 ? "text-destructive" : undefined}>{fmt(totals.net)}</span>
              )
            }
          />
        </div>

        <Panel>
          <PanelHeader title="Monthly breakdown" />
          <PanelBody>
            {isLoading ? (
              <TableSkeleton rows={12} cols={4} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Month</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Income</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Expenses</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[14px]">{MONTHS[i]} {year}</TableCell>
                      <MoneyCell value={row.income} />
                      <MoneyCell value={row.expense} />
                      <MoneyCell
                        value={row.income - row.expense}
                        bold
                        className={row.income - row.expense < 0 ? "text-destructive" : undefined}
                      />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
      </div>
    </DashboardLayout>
  );
}
