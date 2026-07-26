import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelHeader } from "@/components/patterns/Panel";
import { Table, TableBody, TableCell, TableHeader } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download, Banknote } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import {
  BookkeeperHeader,
  PeriodPicker,
  monthBounds,
  EmptyState,
  TableBodySkeletonRows,
  SortableHead,
  useSort,
  sortRows,
  usePagination,
  TablePagination,
  MoneyCell,
} from "@/components/bookkeeper/shared";
import { parseLocalDate } from "@/lib/utils";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

type SortKey = "supplier_paid_date" | "trip" | "supplier" | "method" | "amount";

export default function BookkeeperExpenses() {
  const logAction = useLogBookkeeperAction();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => { logAction("view", "bookkeeper_expenses", { year, month }); }, [logAction, year, month]);

  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-expenses", year, month],
    queryFn: async () => {
      const { start, end } = monthBounds(year, month);
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select("id, confirmation_number, supplier_paid_amount, supplier_paid_date, supplier_paid_method, trip_id, supplier_id, trips:trip_id(trip_name), suppliers:supplier_id(name)")
        .eq("supplier_paid_status", "paid")
        .gte("supplier_paid_date", start)
        .lt("supplier_paid_date", end)
        .order("supplier_paid_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ytdData, isLoading: ytdLoading } = useQuery({
    queryKey: ["bookkeeper-expenses-ytd", year],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select("supplier_paid_amount")
        .eq("supplier_paid_status", "paid")
        .gte("supplier_paid_date", `${year}-01-01`)
        .lte("supplier_paid_date", `${year}-12-31`)
        .limit(1000);
      if (error) throw error;
      return (data ?? []).reduce((s: number, r: any) => s + Number(r.supplier_paid_amount || 0), 0);
    },
  });

  const rows = (data ?? []) as any[];
  const total = rows.reduce((s, r) => s + Number(r.supplier_paid_amount || 0), 0);

  const { sort, onSort } = useSort<SortKey>({ key: "supplier_paid_date", dir: "desc" });
  const sorted = useMemo(
    () => sortRows(rows, sort, (r, k) => {
      if (k === "amount") return Number(r.supplier_paid_amount || 0);
      if (k === "trip") return r.trips?.trip_name ?? "";
      if (k === "supplier") return r.suppliers?.name ?? "";
      if (k === "method") return r.supplier_paid_method ?? "";
      return r.supplier_paid_date ?? "";
    }),
    [rows, sort],
  );

  const pg = usePagination(sorted);

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_expenses", { rows: sorted.length, year, month });
    exportToCSV(
      sorted.map((r: any) => ({
        supplier_paid_date: r.supplier_paid_date,
        trip: r.trips?.trip_name ?? "",
        booking_reference: r.confirmation_number ?? "",
        supplier: r.suppliers?.name ?? "",
        method: r.supplier_paid_method ?? "",
        amount: Number(r.supplier_paid_amount || 0).toFixed(2),
      })),
      `bookkeeper-expenses-${year}-${String(month).padStart(2, "0")}`,
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <BookkeeperHeader
          title="Expenses"
          description="Supplier payments settled in the selected period."
          year={year}
          month={month}
          actions={
            <>
              <PeriodPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || sorted.length === 0}>
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
            </>
          }
        />
        <Panel>
          <PanelHeader
            title="Supplier payments"
            actions={
              (isLoading || ytdLoading) ? (
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ) : (
                <div className="text-right text-[12.5px] text-muted-foreground">
                  <div>
                    Period total: <span className="font-semibold text-foreground tabular-nums">{fmt(total)}</span>
                  </div>
                  <div>
                    YTD {year}: <span className="font-semibold text-foreground tabular-nums">{fmt(Number(ytdData ?? 0))}</span>
                  </div>
                </div>
              )
            }
          />
          <Table>
            <TableHeader>
              <tr>
                <SortableHead label="Paid" sortKey="supplier_paid_date" sort={sort} onSort={onSort} />
                <SortableHead label="Trip / Booking" sortKey="trip" sort={sort} onSort={onSort} />
                <SortableHead label="Supplier" sortKey="supplier" sort={sort} onSort={onSort} />
                <SortableHead label="Method" sortKey="method" sort={sort} onSort={onSort} />
                <SortableHead label="Amount" sortKey="amount" sort={sort} onSort={onSort} align="right" />
              </tr>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableBodySkeletonRows rows={8} cols={5} />
              ) : (
                pg.pageRows.map((r: any) => (
                  <tr key={r.id} className="border-t border-border transition-colors hover:bg-card-2/60">
                    <TableCell>{r.supplier_paid_date ? format(parseLocalDate(r.supplier_paid_date), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <div>{r.trips?.trip_name || "—"}</div>
                      <div className="text-[12px] text-muted-foreground">{r.booking_reference || ""}</div>
                    </TableCell>
                    <TableCell>{r.suppliers?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.supplier_paid_method || "—"}</TableCell>
                    <MoneyCell value={Number(r.supplier_paid_amount || 0)} bold />
                  </tr>
                ))
              )}
            </TableBody>
          </Table>
          <div className="px-[14px] pb-[14px]">
            {!isLoading && sorted.length === 0 && (
              <EmptyState icon={Banknote} title="No supplier payments for this period" description="Try a different month or year." />
            )}
            {!isLoading && sorted.length > 0 && (
              <TablePagination
                page={pg.page}
                totalPages={pg.totalPages}
                total={pg.total}
                rangeStart={pg.rangeStart}
                rangeEnd={pg.rangeEnd}
                onPageChange={pg.setPage}
              />
            )}
          </div>
        </Panel>
      </div>
    </DashboardLayout>
  );
}
