import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Download, CalendarIcon, AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/csvExport";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { fetchClientMap } from "@/lib/bookkeeperLookups";
import { fetchAllRows, fetchInChunks } from "@/lib/fetchAllRows";
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

export default function BookkeeperARAging() {
  const logAction = useLogBookkeeperAction();
  useEffect(() => {
    logAction("view", "bookkeeper_ar_aging");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<BucketKey | "all">("all");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // ── Invoices ──────────────────────────────────────────────────────────────
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["ar-aging-invoices"],
    queryFn: async () => {
      const rows = await fetchAllRows<any>((from, to) =>
        (supabase as any)
          .from("invoices")
          .select(
            "id, invoice_number, invoice_date, trip_name, client_name, total_amount, amount_paid, amount_remaining, status, trip_id, client_id"
          )
          .neq("status", "paid")
          .gt("amount_remaining", 0)
          .order("invoice_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
      const tripIds = [...new Set(rows.map((r: any) => r.trip_id).filter(Boolean))];
      if (tripIds.length === 0) return rows;
      const trips = await fetchInChunks<any>(tripIds, (chunk) =>
        (supabase as any).from("trips").select("id, status").in("id", chunk));
      const pays: any[] = [];
      for (let i = 0; i < tripIds.length; i += 50) {
        const chunk = tripIds.slice(i, i + 50);
        pays.push(...await fetchAllRows<any>((from, to) =>
          (supabase as any).from("trip_payments").select("trip_id, amount").eq("status", "paid").in("trip_id", chunk).order("id", { ascending: true }).range(from, to),
        ));
      }
      const tripStatus: Record<string, string> = {};
      trips.forEach((t: any) => (tripStatus[t.id] = String(t.status || "").toLowerCase()));
      const paidMap: Record<string, number> = {};
      pays.forEach((p: any) => (paidMap[p.trip_id] = (paidMap[p.trip_id] || 0) + Number(p.amount || 0)));
      // Closed trips owe nothing; lead/quoted/planning trips aren't booked, so not receivables.
      const EXCLUDE = ["cancelled", "canceled", "archived", "completed", "lead", "quoted", "planning", "inquiry"];
      return rows
        .filter((r: any) => !r.trip_id || (tripStatus[r.trip_id] !== undefined && !EXCLUDE.includes(tripStatus[r.trip_id])))
        .map((r: any) => {
          if (!r.trip_id) return r;
          const paid = paidMap[r.trip_id] || 0;
          const remaining = Math.max(0, Math.round((Number(r.total_amount || 0) - paid) * 100) / 100);
          return { ...r, amount_paid: paid, amount_remaining: Math.min(Number(r.amount_remaining || 0), remaining) };
        })
        .filter((r: any) => Number(r.amount_remaining) > 0);
    },
  });

  // ── Overdue installment plans ─────────────────────────────────────────────
  const { data: overdueInstallments = [] } = useQuery({
    queryKey: ["ar-aging-installments"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const data = await fetchAllRows<any>((from, to) =>
        (supabase as any)
          .from("trip_payments")
          .select(
            "id, amount, due_date, payment_type, status, details, trip_id, trips:trip_id(trip_name, client_id)"
          )
          .eq("status", "pending")
          .lt("due_date", today)
          .order("due_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
      const clientMap = await fetchClientMap(data.map((r: any) => r.trips?.client_id));
      return data.map((r: any) => ({
        ...r,
        trips: r.trips ? { ...r.trips, clients: clientMap[r.trips.client_id] ?? null } : r.trips,
      }));
    },
  });

  const today = useMemo(() => new Date(), []);

  const aged = useMemo(() => {
    return (invoices ?? [])
      .map((i: any) => {
        const invDate = parseDate(i.invoice_date);
        const days = invDate ? Math.max(0, differenceInDays(today, invDate)) : 0;
        // No explicit due_date column — treat invoice_date as due date.
        const daysOverdue = days;
        return {
          id: i.id,
          invoice_number: i.invoice_number ?? "",
          invoice_date: i.invoice_date,
          due_date: i.invoice_date,
          client_name: i.client_name ?? "",
          trip_name: i.trip_name ?? "",
          total: Number(i.total_amount || 0),
          paid: Number(i.amount_paid || 0),
          balance: Number(i.amount_remaining || 0),
          days: daysOverdue,
          bucket: bucketFor(daysOverdue),
          status: i.status,
        };
      });
  }, [invoices, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return aged.filter((r) => {
      if (bucket !== "all" && r.bucket !== bucket) return false;
      if (q && !r.client_name.toLowerCase().includes(q) && !r.trip_name.toLowerCase().includes(q))
        return false;
      const inv = parseDate(r.invoice_date);
      if (fromDate && inv && inv < fromDate) return false;
      if (toDate && inv && inv > toDate) return false;
      return true;
    });
  }, [aged, bucket, search, fromDate, toDate]);

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
      sums[r.bucket] += r.balance;
      grand += r.balance;
    });
    return { sums, grand };
  }, [aged]);

  type ArSortKey = "client" | "trip" | "invoice_number" | "invoice_date" | "due_date" | "total" | "paid" | "balance" | "days";
  const { sort: arSort, onSort: onArSort } = useSort<ArSortKey>({ key: "invoice_date", dir: "asc" });
  type ArRow = typeof filtered[number];
  const arSorted = useMemo<ArRow[]>(
    () =>
      sortRows<ArRow, ArSortKey>(filtered, arSort, (r, k) => {
        if (k === "client") return r.client_name;
        if (k === "trip") return r.trip_name;
        if (k === "invoice_number") return r.invoice_number;
        if (k === "invoice_date") return r.invoice_date;
        if (k === "due_date") return r.due_date;
        if (k === "total") return r.total;
        if (k === "paid") return r.paid;
        if (k === "balance") return r.balance;
        return r.days;
      }),
    [filtered, arSort],
  );
  const arPg = usePagination<ArRow>(arSorted);

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_ar_aging", { rows: filtered.length });
    exportToCSV(
      filtered.map((r) => ({
        Client: r.client_name,
        Trip: r.trip_name,
        "Invoice #": r.invoice_number,
        Total: r.total.toFixed(2),
        Balance: r.balance.toFixed(2),
        "Due Date": r.due_date ?? "",
        "Days Overdue": r.days,
        Bucket: BUCKET_LABEL[r.bucket],
      })),
      `ar-aging-${new Date().toISOString().slice(0, 10)}`
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px] p-6">
        <BookkeeperHeader
          title="AR Aging"
          description="Accounts receivable bucketed by days overdue."
          year={currentYear}
          month={currentMonth}
          actions={
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          }
        />

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-[14px] md:grid-cols-5">
          <StatTile label="Total AR outstanding" value={fmt(totals.grand)} emphasis />
          <StatTile label="Current" value={fmt(totals.sums.current)} />
          <StatTile label="1–30 days" value={fmt(totals.sums["1-30"])} />
          <StatTile label="31–60 days" value={fmt(totals.sums["31-60"])} />
          <StatTile label="90+ days" value={fmt(totals.sums["90+"])} tone="destructive" />
        </div>

        {/* Filters */}
        <Panel>
          <PanelBody className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search client or trip…"
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

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, "MMM d, yyyy") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, "MMM d, yyyy") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            {(fromDate || toDate || bucket !== "all" || search) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setBucket("all"); setFromDate(undefined); setToDate(undefined); }}>
                Clear
              </Button>
            )}
          </PanelBody>
        </Panel>

        {/* Main table */}
        <Panel>
          <PanelHeader title={`Open invoices (${arPg.total})`} />
          {isLoading ? (
            <PanelBody>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead colSpan={10}>Loading…</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody><TableBodySkeletonRows rows={8} cols={10} /></TableBody>
              </Table>
            </PanelBody>
          ) : filtered.length === 0 ? (
            <PanelBody>
              <EmptyState
                icon={Inbox}
                title="No open invoices"
                description="Nothing matches the current filters."
              />
            </PanelBody>
          ) : (
            <>
              <PanelBody className="p-0">
                <Table>
                  <TableHeader>
                    <tr className="border-b border-border">
                      <SortableHead label="Client" sortKey="client" sort={arSort} onSort={onArSort} />
                      <SortableHead label="Trip" sortKey="trip" sort={arSort} onSort={onArSort} />
                      <SortableHead label="Invoice #" sortKey="invoice_number" sort={arSort} onSort={onArSort} />
                      <SortableHead label="Invoice date" sortKey="invoice_date" sort={arSort} onSort={onArSort} />
                      <SortableHead label="Due date" sortKey="due_date" sort={arSort} onSort={onArSort} />
                      <SortableHead label="Total" sortKey="total" sort={arSort} onSort={onArSort} align="right" />
                      <SortableHead label="Paid" sortKey="paid" sort={arSort} onSort={onArSort} align="right" />
                      <SortableHead label="Balance" sortKey="balance" sort={arSort} onSort={onArSort} align="right" />
                      <SortableHead label="Days outstanding" sortKey="days" sort={arSort} onSort={onArSort} />
                      <TableHead className={HEAD_CLASS}>Bucket</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {arPg.pageRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="max-w-[200px] truncate text-[13.5px] font-medium text-foreground">{r.client_name || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-[13.5px]">{r.trip_name || "—"}</TableCell>
                        <TableCell className="font-mono text-[12px] text-muted-foreground">{r.invoice_number || "—"}</TableCell>
                        <TableCell className="text-[13.5px] text-muted-foreground">{r.invoice_date ? format(parseDate(r.invoice_date)!, "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell className="text-[13.5px] text-muted-foreground">{r.due_date ? format(parseDate(r.due_date)!, "MMM d, yyyy") : "—"}</TableCell>
                        <MoneyCell value={r.total} />
                        <MoneyCell value={r.paid} />
                        <MoneyCell value={r.balance} bold />
                        <TableCell className="tabular-nums text-[13.5px]">{r.days}d</TableCell>
                        <TableCell>
                          <SemanticStatusPill status={bucketStatus(r.bucket)} label={BUCKET_LABEL[r.bucket]} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </PanelBody>
              <div className="border-t border-border px-[14px] py-3">
                <TablePagination
                  page={arPg.page}
                  totalPages={arPg.totalPages}
                  total={arPg.total}
                  rangeStart={arPg.rangeStart}
                  rangeEnd={arPg.rangeEnd}
                  onPageChange={arPg.setPage}
                />
              </div>
            </>
          )}
        </Panel>

        {/* Overdue installment plans */}
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Overdue installment plans ({overdueInstallments.length})
              </span>
            }
          />
          {overdueInstallments.length === 0 ? (
            <PanelBody>
              <div className="py-8 text-center text-[13.5px] text-muted-foreground">
                No overdue installments.
              </div>
            </PanelBody>
          ) : (
            <PanelBody className="p-0">
              <Table>
                <TableHeader>
                  <tr className="border-b border-border">
                    <TableHead className={HEAD_CLASS}>Client</TableHead>
                    <TableHead className={HEAD_CLASS}>Trip</TableHead>
                    <TableHead className={HEAD_CLASS}>Installment</TableHead>
                    <TableHead className={cn(HEAD_CLASS, "text-right")}>Amount due</TableHead>
                    <TableHead className={HEAD_CLASS}>Due date</TableHead>
                    <TableHead className={HEAD_CLASS}>Days overdue</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {overdueInstallments.map((p: any) => {
                    const d = parseDate(p.due_date);
                    const overdue = d ? differenceInDays(today, d) : 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-[200px] truncate text-[13.5px] font-medium text-foreground">
                          {p.trips?.clients
                            ? `${p.trips.clients.first_name ?? ""} ${p.trips.clients.last_name ?? ""}`.trim() || "—"
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-[13.5px]">{p.trips?.trip_name || "—"}</TableCell>
                        <TableCell>
                          <div className="text-[13.5px] text-foreground">{p.payment_type || "payment"}</div>
                          {p.details && (
                            <div className="max-w-[240px] truncate text-[12px] text-muted-foreground">{p.details}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-[13.5px] font-semibold text-foreground">{fmt(Number(p.amount || 0))}</TableCell>
                        <TableCell className="text-[13.5px] text-muted-foreground">{d ? format(d, "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>
                          <SemanticStatusPill status={overdue > 30 ? "destructive" : "warning"} label={`${overdue}d`} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </PanelBody>
          )}
        </Panel>
      </div>
    </DashboardLayout>
  );
}
