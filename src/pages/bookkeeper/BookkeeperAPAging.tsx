import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Inbox } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/csvExport";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import {
  EmptyState,
  SortableHead,
  useSort,
  sortRows,
  usePagination,
  TablePagination,
  MoneyCell,
  TableBodySkeletonRows,
  BookkeeperHeader,
} from "@/components/bookkeeper/shared";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { SemanticStatusPill, type SemanticStatus } from "@/components/patterns/StatusPill";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const parseDate = (s?: string | null) => (s ? new Date(s + "T00:00:00") : null);

type BucketKey = "current" | "1-30" | "31-60" | "61-90" | "90+";
const BUCKET_LABEL: Record<BucketKey, string> = {
  current: "Current",
  "1-30": "1–30",
  "31-60": "31–60",
  "61-90": "61–90",
  "90+": "90+",
};

const bucketFor = (daysOverdue: number): BucketKey => {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
};

const bucketStatus = (b: BucketKey): SemanticStatus => {
  if (b === "90+" || b === "61-90") return "destructive";
  if (b === "31-60") return "warning";
  if (b === "1-30") return "muted";
  return "success";
};

const HEAD_CLASS = "bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground";

function StatTile({ label, value, tone, emphasis }: { label: string; value: string; tone?: "destructive"; emphasis?: boolean }) {
  return (
    <Panel className={cn("p-4", tone === "destructive" && "border-destructive/30")}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-semibold tracking-[-0.025em] tabular-nums text-foreground",
          emphasis ? "text-[20px]" : "text-[17px]",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </div>
    </Panel>
  );
}

export default function BookkeeperAPAging() {
  const logAction = useLogBookkeeperAction();
  useEffect(() => {
    logAction("view", "bookkeeper_ap_aging");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<BucketKey | "all">("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["ap-aging-bookings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select(
          "id, confirmation_number, status, supplier_paid_status, supplier_payout, created_at, trip_id, supplier_id, trips:trip_id(trip_name, return_date, departure_date), suppliers:supplier_id(name, contact_email)"
        )
        .neq("supplier_paid_status", "paid")
        .in("status", ["confirmed", "completed"])
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = useMemo(() => new Date(), []);

  const aged = useMemo(() => {
    return (bookings ?? [])
      .filter((b: any) => Number(b.supplier_payout || 0) > 0)
      .map((b: any) => {
        const returnDate = parseDate(b.trips?.return_date);
        const createdAt = b.created_at ? new Date(b.created_at) : today;
        const estDue = returnDate
          ? addDays(returnDate, 30)
          : addDays(createdAt, 45);
        const daysOverdue = Math.max(0, differenceInDays(today, estDue));
        return {
          id: b.id,
          confirmation_number: b.confirmation_number ?? "",
          supplier_name: b.suppliers?.name ?? "",
          supplier_email: b.suppliers?.contact_email ?? "",
          supplier_id: b.supplier_id ?? "",
          trip_name: b.trips?.trip_name ?? "",
          booking_date: b.created_at,
          est_due: estDue.toISOString().slice(0, 10),
          amount: Number(b.supplier_payout || 0),
          days: daysOverdue,
          bucket: bucketFor(daysOverdue),
          supplier_paid_status: b.supplier_paid_status ?? "unpaid",
        };
      });
  }, [bookings, today]);

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    aged.forEach((r) => {
      if (r.supplier_id) map.set(r.supplier_id, r.supplier_name || "—");
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [aged]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return aged.filter((r) => {
      if (bucket !== "all" && r.bucket !== bucket) return false;
      if (supplierFilter !== "all" && r.supplier_id !== supplierFilter) return false;
      if (q && !r.supplier_name.toLowerCase().includes(q) && !r.trip_name.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [aged, bucket, search, supplierFilter]);

  const totals = useMemo(() => {
    const sums: Record<BucketKey, number> = {
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
    };
    let grand = 0;
    aged.forEach((r) => {
      sums[r.bucket] += r.amount;
      grand += r.amount;
    });
    return { sums, grand };
  }, [aged]);

  type ApSortKey = "supplier" | "trip" | "confirmation" | "booking_date" | "est_due" | "amount" | "days" | "status";
  type ApRow = typeof filtered[number];
  const { sort: apSort, onSort: onApSort } = useSort<ApSortKey>({ key: "est_due", dir: "asc" });
  const apSorted = useMemo<ApRow[]>(
    () =>
      sortRows<ApRow, ApSortKey>(filtered, apSort, (r, k) => {
        if (k === "supplier") return r.supplier_name;
        if (k === "trip") return r.trip_name;
        if (k === "confirmation") return r.confirmation_number;
        if (k === "booking_date") return r.booking_date;
        if (k === "est_due") return r.est_due;
        if (k === "amount") return r.amount;
        if (k === "days") return r.days;
        return r.supplier_paid_status;
      }),
    [filtered, apSort],
  );
  const apPg = usePagination<ApRow>(apSorted);

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_ap_aging", { rows: filtered.length });
    exportToCSV(
      filtered.map((r) => ({
        Supplier: r.supplier_name,
        "Supplier Email": r.supplier_email,
        Trip: r.trip_name,
        "Confirmation #": r.confirmation_number,
        "Booking Date": r.booking_date ? r.booking_date.slice(0, 10) : "",
        "Est. Due Date": r.est_due,
        "Amount Owed": r.amount.toFixed(2),
        "Days Outstanding": r.days,
        Bucket: BUCKET_LABEL[r.bucket],
        "Supplier Paid Status": r.supplier_paid_status,
      })),
      `ap-aging-${new Date().toISOString().slice(0, 10)}`
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px] p-6">
        <BookkeeperHeader
          title="AP Aging"
          description="Unpaid supplier obligations bucketed by days past estimated due date."
          year={currentYear}
          month={currentMonth}
          actions={
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          }
        />

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-[14px] md:grid-cols-4">
          <StatTile label="Total AP outstanding" value={fmt(totals.grand)} emphasis />
          <StatTile label="Current" value={fmt(totals.sums.current)} />
          <StatTile label="1–30 days" value={fmt(totals.sums["1-30"])} />
          <StatTile label="90+ days" value={fmt(totals.sums["90+"])} tone="destructive" />
        </div>

        {/* Filters */}
        <Panel>
          <PanelBody className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search supplier or trip…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Select value={bucket} onValueChange={(v) => setBucket(v as BucketKey | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All buckets</SelectItem>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="1-30">1–30</SelectItem>
                <SelectItem value="31-60">31–60</SelectItem>
                <SelectItem value="61-90">61–90</SelectItem>
                <SelectItem value="90+">90+</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {suppliers.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(bucket !== "all" || supplierFilter !== "all" || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setBucket("all");
                  setSupplierFilter("all");
                }}
              >
                Clear
              </Button>
            )}
          </PanelBody>
        </Panel>

        {/* Main table */}
        <Panel>
          <PanelHeader title={`Unpaid supplier obligations (${apPg.total})`} />
          {isLoading ? (
            <PanelBody>
              <Table>
                <TableHeader><TableRow><TableHead colSpan={9}>Loading…</TableHead></TableRow></TableHeader>
                <TableBody><TableBodySkeletonRows rows={8} cols={9} /></TableBody>
              </Table>
            </PanelBody>
          ) : filtered.length === 0 ? (
            <PanelBody>
              <EmptyState
                icon={Inbox}
                title="No unpaid supplier obligations"
                description="All supplier payments are settled or no rows match the current filters."
              />
            </PanelBody>
          ) : (
            <>
              <PanelBody className="p-0">
                <Table>
                  <TableHeader>
                    <tr className="border-b border-border">
                      <SortableHead label="Supplier" sortKey="supplier" sort={apSort} onSort={onApSort} />
                      <SortableHead label="Trip" sortKey="trip" sort={apSort} onSort={onApSort} />
                      <SortableHead label="Confirmation #" sortKey="confirmation" sort={apSort} onSort={onApSort} />
                      <SortableHead label="Booking date" sortKey="booking_date" sort={apSort} onSort={onApSort} />
                      <SortableHead label="Est. due date" sortKey="est_due" sort={apSort} onSort={onApSort} />
                      <SortableHead label="Amount owed" sortKey="amount" sort={apSort} onSort={onApSort} align="right" />
                      <SortableHead label="Days outstanding" sortKey="days" sort={apSort} onSort={onApSort} />
                      <TableHead className={HEAD_CLASS}>Bucket</TableHead>
                      <SortableHead label="Paid status" sortKey="status" sort={apSort} onSort={onApSort} />
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {apPg.pageRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="max-w-[200px] truncate">
                          <div className="text-[13.5px] font-medium text-foreground">{r.supplier_name || "—"}</div>
                          {r.supplier_email && (
                            <div className="truncate text-[12px] text-muted-foreground">
                              {r.supplier_email}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-[13.5px]">{r.trip_name || "—"}</TableCell>
                        <TableCell className="font-mono text-[12px] text-muted-foreground">{r.confirmation_number || "—"}</TableCell>
                        <TableCell className="text-[13.5px] text-muted-foreground">
                          {r.booking_date ? format(new Date(r.booking_date), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-[13.5px] text-muted-foreground">
                          {r.est_due ? format(parseDate(r.est_due)!, "MMM d, yyyy") : "—"}
                        </TableCell>
                        <MoneyCell value={r.amount} bold />
                        <TableCell className="tabular-nums text-[13.5px]">{r.days}d</TableCell>
                        <TableCell>
                          <SemanticStatusPill status={bucketStatus(r.bucket)} label={BUCKET_LABEL[r.bucket]} />
                        </TableCell>
                        <TableCell>
                          <SemanticStatusPill status="muted" label={r.supplier_paid_status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </PanelBody>
              <div className="border-t border-border px-[14px] py-3">
                <TablePagination
                  page={apPg.page}
                  totalPages={apPg.totalPages}
                  total={apPg.total}
                  rangeStart={apPg.rangeStart}
                  rangeEnd={apPg.rangeEnd}
                  onPageChange={apPg.setPage}
                />
              </div>
            </>
          )}
        </Panel>
      </div>
    </DashboardLayout>
  );
}
