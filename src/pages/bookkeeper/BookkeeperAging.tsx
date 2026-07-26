import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { BookkeeperBreadcrumb, EmptyState, TableSkeleton, MoneyCell } from "@/components/bookkeeper/shared";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { KPITile, KPIGrid } from "@/components/patterns/KPITile";
import { SemanticStatusPill, type SemanticStatus } from "@/components/patterns/StatusPill";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

type Bucket = "0-30" | "31-60" | "61-90" | "90+";
const BUCKETS: Bucket[] = ["0-30", "31-60", "61-90", "90+"];

const bucketFor = (days: number): Bucket =>
  days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";

const bucketStatus = (b: Bucket): SemanticStatus =>
  b === "0-30" ? "muted" : b === "31-60" ? "warning" : "destructive";

const parseDate = (s?: string | null) => (s ? new Date(s + "T00:00:00") : null);

// Shared visual treatment for the (non-sortable) column headers on these tables.
const TH_CLASS = "bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground";

function BucketSummary({ rows }: { rows: { bucket: Bucket; amount: number }[] }) {
  const totals = useMemo(() => {
    const t: Record<Bucket, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    rows.forEach((r) => (t[r.bucket] += r.amount));
    return t;
  }, [rows]);
  const grand = BUCKETS.reduce((s, b) => s + totals[b], 0);
  return (
    <KPIGrid className="grid-cols-2 lg:grid-cols-5">
      {BUCKETS.map((b) => (
        <KPITile key={b} label={`${b} days`} value={fmt(totals[b])} />
      ))}
      <KPITile label="Total outstanding" value={fmt(grand)} className="bg-card-2" />
    </KPIGrid>
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
    <div className="space-y-[18px]">
      <BucketSummary rows={aged.map((a) => ({ bucket: a.bucket, amount: a.amount }))} />

      {overdueScheduled.length > 0 && (
        <Panel className="border-warning/40 bg-warning/5">
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Overdue scheduled client payments
              </span>
            }
            actions={<Badge variant="outline">{overdueScheduled.length}</Badge>}
          />
          <PanelBody>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_CLASS}>Due</TableHead>
                  <TableHead className={TH_CLASS}>Trip</TableHead>
                  <TableHead className={TH_CLASS}>Type</TableHead>
                  <TableHead className={TH_CLASS}>Status</TableHead>
                  <TableHead className={`${TH_CLASS} text-right`}>Amount</TableHead>
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
                        <div className="text-[12px] font-medium text-warning">{overdue}d overdue</div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{p.trips?.trip_name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[11.5px] font-normal">{p.payment_type || "payment"}</Badge></TableCell>
                      <TableCell><SemanticStatusPill status="warning" label={p.status} /></TableCell>
                      <MoneyCell value={Number(p.amount || 0)} bold />
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Open invoices"
          actions={
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || aged.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
            </Button>
          }
        />
        <PanelBody>
          {isLoading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : aged.length === 0 ? (
            <EmptyState title="No open invoices." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_CLASS}>Invoice</TableHead>
                  <TableHead className={TH_CLASS}>Client / Trip</TableHead>
                  <TableHead className={TH_CLASS}>Invoice date</TableHead>
                  <TableHead className={TH_CLASS}>Age</TableHead>
                  <TableHead className={TH_CLASS}>Bucket</TableHead>
                  <TableHead className={`${TH_CLASS} text-right`}>Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aged.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-[12px]">{r.invoice_number || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <div>{r.client_name || "—"}</div>
                      <div className="data-table-secondary">{r.trip_name || ""}</div>
                    </TableCell>
                    <TableCell>{r.invoice_date ? format(parseDate(r.invoice_date)!, "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.days}d</TableCell>
                    <TableCell>
                      <SemanticStatusPill status={bucketStatus(r.bucket)} label={r.bucket} />
                    </TableCell>
                    <MoneyCell value={r.amount} bold />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </PanelBody>
      </Panel>
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
    <div className="space-y-[18px]">
      <BucketSummary rows={aged.map((a) => ({ bucket: a.bucket, amount: a.amount }))} />
      <Panel>
        <PanelHeader
          title="Unpaid supplier bookings"
          actions={
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || aged.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
            </Button>
          }
        />
        <PanelBody>
          {isLoading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : aged.length === 0 ? (
            <EmptyState title="All supplier payments are settled." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TH_CLASS}>Supplier</TableHead>
                  <TableHead className={TH_CLASS}>Trip / Booking</TableHead>
                  <TableHead className={TH_CLASS}>Departure</TableHead>
                  <TableHead className={TH_CLASS}>Age</TableHead>
                  <TableHead className={TH_CLASS}>Bucket</TableHead>
                  <TableHead className={TH_CLASS}>Status</TableHead>
                  <TableHead className={`${TH_CLASS} text-right`}>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aged.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.suppliers?.name || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <div>{r.trips?.trip_name || "—"}</div>
                      <div className="data-table-secondary">{r.booking_reference || ""}</div>
                    </TableCell>
                    <TableCell>
                      {r.trips?.departure_date
                        ? format(parseDate(r.trips.departure_date)!, "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{r.days}d</TableCell>
                    <TableCell>
                      <SemanticStatusPill status={bucketStatus(r.bucket)} label={r.bucket} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.supplier_paid_status || "unpaid"}</Badge>
                    </TableCell>
                    <MoneyCell value={r.amount} bold />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </PanelBody>
      </Panel>
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
      <div className="space-y-[18px] p-6">
        <div className="space-y-2">
          <BookkeeperBreadcrumb page="AR / AP Aging" />
          <div className="space-y-1">
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">AR / AP Aging</h1>
            <p className="text-[13.5px] text-muted-foreground">
              Outstanding receivables and payables bucketed by days overdue.
            </p>
          </div>
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
