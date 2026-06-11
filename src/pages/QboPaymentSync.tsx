import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { useQboPaymentSyncStatus, type PaymentSyncRow, type SyncState } from "@/hooks/useQboPaymentSyncStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PaymentSyncStatusBadge } from "@/components/qbo/PaymentSyncStatusBadge";
import { format } from "date-fns";
import { RefreshCw, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PAGE_SIZE = 25;

export default function QboPaymentSync() {
  const { isAdmin, isOfficeAdmin, isBookkeeper, isLoading: permsLoading } = usePermissions();
  const canAccess = isAdmin || isOfficeAdmin || isBookkeeper;
  const { data, isLoading, refetch, isRefetching } = useQboPaymentSyncStatus();
  const [filter, setFilter] = useState<SyncState | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [detail, setDetail] = useState<PaymentSyncRow | null>(null);

  const rows = data ?? [];
  const counts = useMemo(() => {
    const c = { all: rows.length, synced: 0, failed: 0, pending: 0, not_eligible: 0 };
    rows.forEach((r) => { c[r.sync_state]++; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.sync_state !== filter) return false;
      if (q && !`${r.client_name ?? ""} ${r.trip_name ?? ""} ${r.qbo_payment_id ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, search]);

  if (permsLoading) return <DashboardLayout><Skeleton className="h-96" /></DashboardLayout>;
  if (!canAccess) return <Navigate to="/" replace />;

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const pushOne = async (id: string) => {
    setBusy((b) => new Set(b).add(id));
    try {
      const { data, error } = await supabase.functions.invoke("qbo-backfill-payments", {
        body: { payment_ids: [id] },
      });
      if (error) throw error;
      const r = data?.results?.[0];
      if (r?.status === "synced") toast.success("Pushed to QBO");
      else if (r?.status === "failed") toast.error(`Failed: ${r.error?.slice(0, 200) ?? "unknown"}`);
      else toast.info(`Result: ${r?.status ?? "unknown"}`);
      await refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy((b) => { const n = new Set(b); n.delete(id); return n; });
    }
  };

  const retryAllFailed = async () => {
    const ids = rows.filter((r) => r.sync_state === "failed").map((r) => r.id);
    if (!ids.length) return toast.info("No failed payments");
    setBulkBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("qbo-backfill-payments", {
        body: { payment_ids: ids },
      });
      if (error) throw error;
      toast.success(`Retried ${ids.length}: ${data?.summary?.synced ?? 0} synced, ${data?.summary?.failed ?? 0} failed`);
      await refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Bulk retry failed");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">QBO Payment Sync</h1>
            <p className="text-muted-foreground">Per-payment sync status with errors and retry actions.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button onClick={retryAllFailed} disabled={bulkBusy || counts.failed === 0}>
              <Upload className="w-4 h-4 mr-2" />Retry all failed ({counts.failed})
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(["all", "synced", "pending", "failed", "not_eligible"] as const).map((k) => (
            <Card key={k} className="cursor-pointer" onClick={() => { setFilter(k); setPage(0); }}>
              <CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{k.replace("_", " ")}</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{counts[k]}</div></CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <Tabs value={filter} onValueChange={(v) => { setFilter(v as any); setPage(0); }}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="synced">Synced</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="failed">Failed</TabsTrigger>
                  <TabsTrigger value="not_eligible">Not eligible</TabsTrigger>
                </TabsList>
              </Tabs>
              <Input
                placeholder="Search client, trip, or QBO ID"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="max-w-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96" />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client / Trip</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>QBO Payment ID</TableHead>
                      <TableHead>Synced At</TableHead>
                      <TableHead>Last Error</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{r.payment_date ?? "—"}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.client_name ?? "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{r.trip_name ?? "—"}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono">${r.amount.toFixed(2)}</TableCell>
                        <TableCell className="capitalize">{r.payment_type ?? "—"}</TableCell>
                        <TableCell><PaymentSyncStatusBadge state={r.sync_state} /></TableCell>
                        <TableCell className="font-mono text-xs">{r.qbo_payment_id ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.synced_at ? format(new Date(r.synced_at), "MMM d, HH:mm") : "—"}</TableCell>
                        <TableCell className="max-w-[240px]">
                          {r.last_error ? (
                            <span className="text-xs text-destructive line-clamp-2" title={r.last_error}>{r.last_error}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>Details</Button>
                            {(r.sync_state === "pending" || r.sync_state === "failed") && (
                              <Button size="sm" onClick={() => pushOne(r.id)} disabled={busy.has(r.id)}>
                                {busy.has(r.id) ? "..." : "Push"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pageRows.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No payments match the filter.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {pageRows.length} of {filtered.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">Page {page + 1} of {totalPages}</span>
                    <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>Payment Sync Details</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Client:</span> {detail.client_name ?? "—"}</div>
                  <div><span className="text-muted-foreground">Trip:</span> {detail.trip_name ?? "—"}</div>
                  <div><span className="text-muted-foreground">Date:</span> {detail.payment_date ?? "—"}</div>
                  <div><span className="text-muted-foreground">Amount:</span> ${detail.amount.toFixed(2)}</div>
                  <div><span className="text-muted-foreground">Status:</span> <PaymentSyncStatusBadge state={detail.sync_state} /></div>
                  <div><span className="text-muted-foreground">QBO ID:</span> {detail.qbo_payment_id ?? "—"}</div>
                  <div><span className="text-muted-foreground">QBO Invoice:</span> {detail.qbo_invoice_id ?? "—"}</div>
                  <div><span className="text-muted-foreground">Synced At:</span> {detail.synced_at ? format(new Date(detail.synced_at), "PPp") : "—"}</div>
                </div>
                <div className="font-mono text-xs text-muted-foreground">Payment ID: {detail.id}</div>
                {detail.last_error && (
                  <div>
                    <div className="font-semibold mb-1">Last Error</div>
                    <pre className="bg-destructive/10 text-destructive p-3 rounded text-xs whitespace-pre-wrap">{detail.last_error}</pre>
                  </div>
                )}
                <div>
                  <div className="font-semibold mb-2">Sync History ({detail.log_history.length})</div>
                  {detail.log_history.length === 0 && <div className="text-muted-foreground">No sync log entries found for this payment.</div>}
                  <div className="space-y-2">
                    {detail.log_history.map((l) => (
                      <div key={l.id} className="border rounded p-2 text-xs">
                        <div className="flex justify-between">
                          <span className="font-medium">{l.sync_type}</span>
                          <span className={l.status === "error" ? "text-destructive" : "text-emerald-600"}>{l.status}</span>
                        </div>
                        <div className="text-muted-foreground">{format(new Date(l.created_at), "PPp")}</div>
                        {l.error_message && <div className="text-destructive mt-1">{l.error_message}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
