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
import { Download, RefreshCw } from "lucide-react";
import { parseQboProfitLoss } from "@/lib/qboProfitLoss";
import { exportToCSV } from "@/lib/csvExport";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { PeriodLockButton } from "@/components/bookkeeper/PeriodLockButton";
import { BookkeeperBreadcrumb, TableSkeleton, MoneyCell } from "@/components/bookkeeper/shared";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { KPITile } from "@/components/patterns/KPITile";

const fmt = (n: number) =>
  Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

function usePLData(year: number) {
  return useQuery({
    queryKey: ["bookkeeper-pl-qbo", year],
    queryFn: async () => {
      return Promise.all(Array.from({ length: 12 }, async (_, index) => {
        const month = String(index + 1).padStart(2, "0");
        const lastDay = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
        const params = new URLSearchParams({
          action: "read-report", report: "ProfitAndLoss",
          start_date: `${year}-${month}-01`, end_date: `${year}-${month}-${lastDay}`,
        });
        const { data, error } = await supabase.functions.invoke(`qbo-sync?${params}`, { method: "GET" });
        if (error) throw new Error("QuickBooks P&L is unavailable. Please retry or check the QuickBooks connection.");
        return parseQboProfitLoss(data);
      }));
    },
    staleTime: 60_000,
    retry: false,
  });
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function BookkeeperPL() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading, error, refetch, isFetching } = usePLData(year);
  const logAction = useLogBookkeeperAction();
  useEffect(() => { logAction("view", "bookkeeper_pl", { year }); }, [logAction, year]);

  const totals = useMemo(() => {
    const income = (data ?? []).reduce((s, m) => s + m.income, 0);
    const expense = (data ?? []).reduce((s, m) => s + m.expense, 0);
    const net = (data ?? []).reduce((s, m) => s + m.net, 0);
    return { income, expense, net };
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
        net: row.net.toFixed(2),
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
                QuickBooks · Accrual basis · USD
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
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh QuickBooks P&L" title="Refresh QuickBooks P&L">
                <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !(data?.length)} className="text-[13px]">
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>
        </div>

        {error && <p role="alert" className="text-destructive">{error.message}</p>}
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
          <KPITile
            label="Total Income"
            value={isLoading ? <Skeleton className="h-[26px] w-24" /> : error ? "—" : fmt(totals.income)}
          />
          <KPITile
            label="Total Expenses"
            value={isLoading ? <Skeleton className="h-[26px] w-24" /> : error ? "—" : fmt(totals.expense)}
          />
          <KPITile
            label="Net Income"
            value={
              isLoading ? (
                <Skeleton className="h-[26px] w-24" />
              ) : error ? "—" : (
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
            ) : error ? null : (
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
                        value={row.net}
                        bold
                        className={row.net < 0 ? "text-destructive" : undefined}
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
