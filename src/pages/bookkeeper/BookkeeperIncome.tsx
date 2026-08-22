import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Table, TableBody, TableCell, TableHeader } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download, DollarSign } from "lucide-react";
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
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { parseLocalDate } from "@/lib/utils";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

type SortKey = "payment_date" | "trip" | "payment_type" | "payment_method" | "amount";

export default function BookkeeperIncome() {
  const logAction = useLogBookkeeperAction();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => { logAction("view", "bookkeeper_income", { year, month }); }, [logAction, year, month]);

  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-income", year, month],
    queryFn: async () => {
      const { start, end } = monthBounds(year, month);
      const { data, error } = await (supabase as any)
        .from("trip_payments")
        .select("id, amount, payment_date, payment_method, payment_type, status, stripe_payment_intent_id, trip_id, trips:trip_id(trip_name)")
        .eq("status", "paid")
        .gte("payment_date", start)
        .lt("payment_date", end)
        .order("payment_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const monthRange = useMemo(() => monthBounds(year, month), [year, month]);
  const { data: otherIncome } = useAgencyOtherIncome(monthRange);

  // Client payments + agency other income (advisor subscriptions, loan interest)
  const rows = useMemo(() => {
    const clientRows = ((data ?? []) as any[]).map((r) => ({ ...r, source: "client_payment" }));
    const otherRows = (otherIncome?.rows ?? []).map((r) => ({
      id: r.id,
      amount: r.amount,
      payment_date: r.date,
      payment_method: r.source === "agent_subscription" ? "subscription" : "loan",
      payment_type: r.source === "agent_subscription" ? "advisor subscription" : "loan interest",
      stripe_payment_intent_id: r.reference,
      trips: { trip_name: r.label },
      source: r.source,
    }));
    return [...clientRows, ...otherRows.filter((r) => Number(r.amount) > 0)];
  }, [data, otherIncome]);

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const otherTotal = otherIncome?.total ?? 0;

  const { sort, onSort } = useSort<SortKey>({ key: "payment_date", dir: "desc" });
  const sorted = useMemo(
    () => sortRows(rows, sort, (r, k) => {
      if (k === "amount") return Number(r.amount || 0);
      if (k === "trip") return r.trips?.trip_name ?? "";
      if (k === "payment_method") return r.payment_method ?? "";
      if (k === "payment_type") return r.payment_type ?? "";
      return r.payment_date ?? "";
    }),
    [rows, sort],
  );

  const pg = usePagination(sorted);

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_income", { rows: sorted.length, year, month });
    exportToCSV(
      sorted.map((r: any) => ({
        payment_date: r.payment_date,
        trip: r.trips?.trip_name ?? "",
        payment_type: r.payment_type ?? "",
        payment_method: r.payment_method ?? "",
        stripe_payment_intent_id: r.stripe_payment_intent_id ?? "",
        amount: Number(r.amount || 0).toFixed(2),
      })),
      `bookkeeper-income-${year}-${String(month).padStart(2, "0")}`,
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <BookkeeperHeader
          title="Income"
          description="Paid client payments for the selected period."
          year={year}
          month={month}
          actions={
            <>
              <PeriodPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || sorted.length === 0} className="text-[13px]">
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            </>
          }
        />
        <Panel>
          <PanelHeader
            title="Paid payments"
            actions={
              !isLoading && (
                <div className="text-[12.5px] text-muted-foreground">
                  Total: <span className="text-[13px] font-semibold text-foreground tabular-nums">{fmt(total)}</span>
                </div>
              )
            }
          />
          <PanelBody>
            <Table>
              <TableHeader>
                <tr className="border-b">
                  <SortableHead label="Date" sortKey="payment_date" sort={sort} onSort={onSort} />
                  <SortableHead label="Trip" sortKey="trip" sort={sort} onSort={onSort} />
                  <SortableHead label="Type" sortKey="payment_type" sort={sort} onSort={onSort} />
                  <SortableHead label="Method" sortKey="payment_method" sort={sort} onSort={onSort} />
                  <SortableHead label="Amount" sortKey="amount" sort={sort} onSort={onSort} align="right" />
                </tr>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableBodySkeletonRows rows={8} cols={5} />
                ) : (
                  pg.pageRows.map((r: any) => (
                    <tr key={r.id} className="border-b transition-colors hover:bg-muted/50">
                      <TableCell className="text-[14px]">{r.payment_date ? format(parseLocalDate(r.payment_date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="max-w-xs truncate text-[14px]">{r.trips?.trip_name || "—"}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-[20px] border border-border px-[9px] py-[2px] text-[11.5px] font-medium capitalize text-muted-foreground">
                          {r.payment_type || "payment"}
                        </span>
                      </TableCell>
                      <TableCell className="text-[14px] text-muted-foreground">{r.payment_method || (r.stripe_payment_intent_id ? "stripe" : "—")}</TableCell>
                      <MoneyCell value={Number(r.amount || 0)} bold />
                    </tr>
                  ))
                )}
              </TableBody>
            </Table>
            {!isLoading && sorted.length === 0 && (
              <EmptyState icon={DollarSign} title="No income for this period" description="Try selecting a different month or year." />
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
          </PanelBody>
        </Panel>
      </div>
    </DashboardLayout>
  );
}
