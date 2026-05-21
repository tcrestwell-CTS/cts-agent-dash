import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Download, CalendarIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/csvExport";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";

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

const bucketVariant = (b: BucketKey): "outline" | "secondary" | "destructive" => {
  if (b === "90+") return "destructive";
  if (b === "61-90") return "destructive";
  if (b === "31-60") return "secondary";
  return "outline";
};

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

  // ── Invoices ──────────────────────────────────────────────────────────────
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["ar-aging-invoices"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select(
          "id, invoice_number, invoice_date, trip_name, client_name, total_amount, amount_paid, amount_remaining, status, trip_id, client_id"
        )
        .neq("status", "paid")
        .gt("amount_remaining", 0)
        .order("invoice_date", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Overdue installment plans ─────────────────────────────────────────────
  const { data: overdueInstallments = [] } = useQuery({
    queryKey: ["ar-aging-installments"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await (supabase as any)
        .from("trip_payments")
        .select(
          "id, amount, due_date, payment_type, status, details, trip_id, trips:trip_id(trip_name, clients:client_id(first_name, last_name))"
        )
        .eq("status", "pending")
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
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
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">AR Aging</h1>
            <p className="text-muted-foreground text-sm">
              Accounts receivable bucketed by days overdue.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total AR outstanding</div>
              <div className="text-xl font-semibold">{fmt(totals.grand)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Current</div>
              <div className="text-lg font-semibold">{fmt(totals.sums.current)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">1–30 days</div>
              <div className="text-lg font-semibold">{fmt(totals.sums["1-30"])}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">31–60 days</div>
              <div className="text-lg font-semibold">{fmt(totals.sums["31-60"])}</div>
            </CardContent>
          </Card>
          <Card className="border-destructive/40">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">90+ days</div>
              <div className="text-lg font-semibold text-destructive">
                {fmt(totals.sums["90+"])}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
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
          </CardContent>
        </Card>

        {/* Main table */}
        <Card>
          <CardHeader>
            <CardTitle>Open invoices ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No open invoices match the current filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Trip</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Invoice date</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Days outstanding</TableHead>
                    <TableHead>Bucket</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-[200px] truncate">{r.client_name || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.trip_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.invoice_number || "—"}</TableCell>
                      <TableCell>{r.invoice_date ? format(parseDate(r.invoice_date)!, "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>{r.due_date ? format(parseDate(r.due_date)!, "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="text-right">{fmt(r.total)}</TableCell>
                      <TableCell className="text-right">{fmt(r.paid)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(r.balance)}</TableCell>
                      <TableCell>{r.days}d</TableCell>
                      <TableCell>
                        <Badge variant={bucketVariant(r.bucket)}>{BUCKET_LABEL[r.bucket]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Overdue installment plans */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Overdue installment plans ({overdueInstallments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueInstallments.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No overdue installments.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Trip</TableHead>
                    <TableHead>Installment</TableHead>
                    <TableHead className="text-right">Amount due</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Days overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueInstallments.map((p: any) => {
                    const d = parseDate(p.due_date);
                    const overdue = d ? differenceInDays(today, d) : 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-[200px] truncate">
                          {p.trips?.clients
                            ? `${p.trips.clients.first_name ?? ""} ${p.trips.clients.last_name ?? ""}`.trim() || "—"
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.trips?.trip_name || "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm">{p.payment_type || "payment"}</div>
                          {p.details && (
                            <div className="text-xs text-muted-foreground truncate max-w-[240px]">{p.details}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(p.amount || 0))}</TableCell>
                        <TableCell>{d ? format(d, "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>
                          {overdue > 30 ? (
                            <Badge variant="destructive">{overdue}d</Badge>
                          ) : (
                            <Badge variant="secondary">{overdue}d</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}