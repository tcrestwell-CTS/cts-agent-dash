import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useEffect } from "react";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { PeriodLockButton } from "@/components/bookkeeper/PeriodLockButton";
import { BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";

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
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <BookkeeperBreadcrumb page="P&L" />
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-semibold">Profit & Loss</h1>
              <PeriodLockButton year={year} month={new Date().getMonth() + 1} />
            </div>
            <p className="text-muted-foreground text-sm">
              Cash-basis income minus supplier expenses by month.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !(data?.length)}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Income</CardTitle></CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-7 w-28" /> : <div className="text-2xl font-bold">{fmt(totals.income)}</div>}</CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle></CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-7 w-28" /> : <div className="text-2xl font-bold">{fmt(totals.expense)}</div>}</CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net Income</CardTitle></CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-7 w-28" /> : <div className={`text-2xl font-bold ${totals.net >= 0 ? "" : "text-destructive"}`}>{fmt(totals.net)}</div>}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Monthly breakdown</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((row, i) => (
                   <TableRow key={i}>
                      <TableCell>{MONTHS[i]} {year}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(row.income)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(row.expense)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${row.income - row.expense < 0 ? "text-destructive" : ""}`}>{fmt(row.income - row.expense)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}