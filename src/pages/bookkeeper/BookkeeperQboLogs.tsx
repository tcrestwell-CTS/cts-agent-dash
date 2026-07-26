import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/csvExport";
import { Download } from "lucide-react";
import { BookkeeperBreadcrumb, TableSkeleton } from "@/components/bookkeeper/shared";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { SemanticStatusPill, type SemanticStatus } from "@/components/patterns/StatusPill";

type StatusFilter = "all" | "success" | "error" | "pending";

const STATUS_SEMANTIC: Record<string, SemanticStatus> = {
  success: "success",
  error: "destructive",
  pending: "warning",
};

export default function BookkeeperQboLogs() {
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-qbo-logs", status],
    queryFn: async () => {
      let q = (supabase as any)
        .from("qbo_sync_logs")
        .select("id, sync_type, direction, status, records_processed, error_message, created_at, retry_count")
        .order("created_at", { ascending: false })
        .limit(300);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const exportCsv = () => {
    exportToCSV(
      (data ?? []).map((r: any) => ({
        created_at: r.created_at,
        sync_type: r.sync_type,
        direction: r.direction,
        status: r.status,
        records_processed: r.records_processed,
        retry_count: r.retry_count,
        error_message: r.error_message ?? "",
      })),
      `qbo-sync-logs-${new Date().toISOString().slice(0, 10)}`,
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="space-y-2">
          <BookkeeperBreadcrumb page="QBO Sync Logs" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">QBO Sync Logs</h1>
              <p className="text-[13.5px] text-muted-foreground">Recent QuickBooks sync activity. Read-only.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger className="w-36 text-[13.5px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !(data?.length)} className="text-[13px]">
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>
        </div>

        <Panel>
          <PanelHeader title="Last 300 entries" />
          <PanelBody>
            {isLoading ? (
              <TableSkeleton rows={8} cols={6} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">When</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Sync type</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Direction</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Status</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Records</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-[14px]">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                      <TableCell className="text-[14px]">{r.sync_type}</TableCell>
                      <TableCell className="text-[14px] text-muted-foreground">{r.direction}</TableCell>
                      <TableCell>
                        <SemanticStatusPill status={STATUS_SEMANTIC[r.status] ?? "muted"} label={r.status} />
                      </TableCell>
                      <TableCell className="text-right text-[14px] tabular-nums">{r.records_processed}</TableCell>
                      <TableCell className="max-w-md truncate text-[12px] text-muted-foreground" title={r.error_message ?? ""}>
                        {r.error_message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-[13px] text-muted-foreground">No log entries.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
      </div>
    </DashboardLayout>
  );
}
