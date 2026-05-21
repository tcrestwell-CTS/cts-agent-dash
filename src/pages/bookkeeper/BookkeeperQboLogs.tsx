import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/csvExport";
import { Download } from "lucide-react";
import { BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";

type StatusFilter = "all" | "success" | "error" | "pending";

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
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <BookkeeperBreadcrumb page="QBO Sync Logs" />
            <h1 className="text-3xl font-semibold">QBO Sync Logs</h1>
            <p className="text-muted-foreground text-sm">Recent QuickBooks sync activity. Read-only.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !(data?.length)}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Last 300 entries</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Sync type</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                      <TableCell>{r.sync_type}</TableCell>
                      <TableCell className="text-muted-foreground">{r.direction}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "error" ? "destructive" : r.status === "success" ? "outline" : "secondary"}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.records_processed}</TableCell>
                      <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={r.error_message ?? ""}>
                        {r.error_message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No log entries.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}