import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/csvExport";
import { useEffect, useMemo } from "react";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { format, differenceInDays } from "date-fns";
import { BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

type Bucket = "0-30" | "31-60" | "61-90" | "90+";
const BUCKETS: Bucket[] = ["0-30", "31-60", "61-90", "90+"];

const bucketFor = (days: number): Bucket =>
  days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";

const parseDate = (s?: string | null) => (s ? new Date(s + "T00:00:00") : null);

function BucketSummary({ rows }: { rows: { bucket: Bucket; amount: number }[] }) {
  const totals = useMemo(() => {
    const t: Record<Bucket, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    rows.forEach((r) => (t[r.bucket] += r.amount));
    return t;
  }, [rows]);
  const grand = BUCKETS.reduce((s, b) => s + totals[b], 0);
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {BUCKETS.map((b) => (
        <Card key={b}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{b} days</div>
            <div className="text-lg font-semibold">{fmt(totals[b])}</div>
          </CardContent>
        </Card>
      ))}
      <Card className="bg-muted/40">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total outstanding</div>
          <div className="text-lg font-semibold">{fmt(grand)}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReceivablesTab() {
  const logAction = useLogBookkeeperAction();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["bookkeeper-aging-ar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select("id, invoice_number, invoice_date, trip_name, client_name, total_amount, amount_paid, amount_remaining, status")
        .neq("status", "paid")
        .order("invoice_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: overdueScheduled = [] } = useQuery({
    queryKey: ["bookkeeper-aging-ar-overdue-scheduled"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await (supabase as any)
        .from("trip_payments")
        .select("id, amount, due_date, payment_type, status, trip_id, trips:trip_id(trip_name)")
        .in("status", ["scheduled", "pending"])
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date();
  const aged = useMemo(
    () =>
      (invoices ?? [])
        .filter((i: any) => Number(i.amount_remaining || 0) > 0 && i.invoice_date)
        .map((i: any) => {
          const days = Math.max(0, differenceInDays(today, parseDate(i.invoice_date)!));
          return {
            ...i,
            days,
            bucket: bucketFor(days),
            amount: Number(i.amount_remaining || 0),
          };
        }),
    [invoices],
  );

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_aging_ar", { rows: aged.length });
    exportToCSV(
      aged.map((r) => ({
        invoice_number: r.invoice_number ?? "",
        invoice_date: r.invoice_date,
        client: r.client_name ?? "",
        trip: r.trip_name ?? "",
        status: r.status,
        days_outstanding: r.days,
        bucket: r.bucket,
        total: Number(r.total_amount || 0).toFixed(2),
        paid: Number(r.amount_paid || 0).toFixed(2),
        remaining: r.amount.toFixed(2),
      })),
      `bookkeeper-ar-aging-${new Date().toISOString().slice(0, 10)}`,
    );
  };

  return (
    <div className="space-y-4">
      <BucketSummary rows={aged.map((a) => ({ bucket: a.bucket, amount: a.amount }))} />

      {overdueScheduled.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Overdue scheduled client payments
            </CardTitle>
            <Badge variant="outline">{overdueScheduled.length}</Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due</TableHead>
                  <TableHead>Trip</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueScheduled.map((p: any) => {
                  const d = parseDate(p.due_date);
                  const overdue = d ? differenceInDays(today, d) : 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        {d ? format(d, "MMM d, yyyy") : "—"}
                        <div className="text-xs text-amber-700">{overdue}d overdue</div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{p.trips?.trip_name || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{p.payment_type || "payment"}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(p.amount || 0))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Open invoices</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || aged.length === 0}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : aged.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No open invoices.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client / Trip</TableHead>
                  <TableHead>Invoice date</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aged.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.invoice_number || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <div>{r.client_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.trip_name || ""}</div>
                    </TableCell>
                    <TableCell>{r.invoice_date ? format(parseDate(r.invoice_date)!, "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell>{r.days}d</TableCell>
                    <TableCell>
                      <Badge variant={r.bucket === "90+" ? "destructive" : r.bucket === "61-90" ? "secondary" : "outline"}>
                        {r.bucket}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(r.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PayablesTab() {
  const logAction = useLogBookkeeperAction();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookkeeper-aging-ap"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select("id, booking_reference, status, supplier_paid_status, supplier_payout, gross_sales, created_at, trip_id, supplier_id, trips:trip_id(trip_name, departure_date), suppliers:supplier_id(name)")
        .in("supplier_paid_status", ["unpaid", "pending", "partial"])
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date();
  const aged = useMemo(
    () =>
      (bookings ?? [])
        .filter((b: any) => Number(b.supplier_payout || 0) > 0)
        .map((b: any) => {
          const ref = b.trips?.departure_date || b.created_at;
          const refDate = ref ? new Date(ref) : today;
          const days = Math.max(0, differenceInDays(today, refDate));
          return {
            ...b,
            days,
            bucket: bucketFor(days),
            amount: Number(b.supplier_payout || 0),
          };
        }),
    [bookings],
  );

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_aging_ap", { rows: aged.length });
    exportToCSV(
      aged.map((r) => ({
        booking_reference: r.booking_reference ?? "",
        supplier: r.suppliers?.name ?? "",
        trip: r.trips?.trip_name ?? "",
        departure_date: r.trips?.departure_date ?? "",
        supplier_paid_status: r.supplier_paid_status ?? "",
        days_outstanding: r.days,
        bucket: r.bucket,
        amount_due: r.amount.toFixed(2),
      })),
      `bookkeeper-ap-aging-${new Date().toISOString().slice(0, 10)}`,
    );
  };

  return (
    <div className="space-y-4">
      <BucketSummary rows={aged.map((a) => ({ bucket: a.bucket, amount: a.amount }))} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Unpaid supplier bookings</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || aged.length === 0}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : aged.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">All supplier payments are settled.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Trip / Booking</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aged.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.suppliers?.name || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <div>{r.trips?.trip_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.booking_reference || ""}</div>
                    </TableCell>
                    <TableCell>
                      {r.trips?.departure_date
                        ? format(parseDate(r.trips.departure_date)!, "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>{r.days}d</TableCell>
                    <TableCell>
                      <Badge variant={r.bucket === "90+" ? "destructive" : r.bucket === "61-90" ? "secondary" : "outline"}>
                        {r.bucket}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.supplier_paid_status || "unpaid"}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(r.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BookkeeperAging() {
  const logAction = useLogBookkeeperAction();
  useEffect(() => {
    logAction("view", "bookkeeper_aging");
  }, [logAction]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="space-y-1">
          <BookkeeperBreadcrumb page="AR / AP Aging" />
          <h1 className="text-3xl font-semibold">AR / AP Aging</h1>
          <p className="text-muted-foreground text-sm">
            Outstanding receivables and payables bucketed by days overdue.
          </p>
        </div>
        <Tabs defaultValue="ar">
          <TabsList>
            <TabsTrigger value="ar">Receivables (AR)</TabsTrigger>
            <TabsTrigger value="ap">Payables (AP)</TabsTrigger>
          </TabsList>
          <TabsContent value="ar" className="mt-4">
            <ReceivablesTab />
          </TabsContent>
          <TabsContent value="ap" className="mt-4">
            <PayablesTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}