import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQBOConnection } from "@/hooks/useQBOConnection";
import { useQBOSyncLogs } from "@/hooks/useQBOSyncLogs";
import { useIsAdmin } from "@/hooks/useAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity, Clock, Wifi, WifiOff, ShieldAlert } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Navigate } from "react-router-dom";

type FilterStatus = "all" | "success" | "error";

export default function QBOHealth() {
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { status, loading: connLoading, refreshStatus } = useQBOConnection();
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQBOSyncLogs(100);
  const [filter, setFilter] = useState<FilterStatus>("all");

  if (adminLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Skeleton className="h-8 w-48" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const filteredLogs = logs?.filter((log) => {
    if (filter === "all") return true;
    return log.status === filter;
  });

  const errorCount = logs?.filter((l) => l.status === "error").length ?? 0;
  const successCount = logs?.filter((l) => l.status === "success").length ?? 0;
  const totalSyncs = logs?.length ?? 0;
  const successRate = totalSyncs > 0 ? Math.round((successCount / totalSyncs) * 100) : 0;

  const lastSync = logs?.[0];
  const tokenExpiry = status.connection?.token_expires_at
    ? new Date(status.connection.token_expires_at)
    : null;
  const tokenExpired = tokenExpiry ? tokenExpiry <= new Date() : false;

  const handleRefresh = () => {
    refreshStatus();
    refetchLogs();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              QuickBooks Integration Health
            </h1>
            <p className="text-muted-foreground">
              Monitor connection status, sync history, and errors
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Connection</CardTitle>
              {status.connected ? (
                <Wifi className="h-4 w-4 text-emerald-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              {connLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <>
                  <div className="text-xl font-bold">
                    {status.connected ? "Connected" : "Disconnected"}
                  </div>
                  {status.connection?.company_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {status.connection.company_name}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Token Status</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {connLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : !tokenExpiry ? (
                <div className="text-xl font-bold text-muted-foreground">N/A</div>
              ) : (
                <>
                  <div className={`text-xl font-bold ${tokenExpired ? "text-destructive" : "text-emerald-600"}`}>
                    {tokenExpired ? "Expired" : "Valid"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tokenExpired
                      ? `Expired ${formatDistanceToNow(tokenExpiry)} ago`
                      : `Expires in ${formatDistanceToNow(tokenExpiry)}`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <>
                  <div className={`text-xl font-bold ${successRate >= 90 ? "text-emerald-600" : successRate >= 70 ? "text-amber-600" : "text-destructive"}`}>
                    {successRate}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {successCount} of {totalSyncs} syncs
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${errorCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <>
                  <div className={`text-xl font-bold ${errorCount > 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {errorCount}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lastSync
                      ? `Last sync ${formatDistanceToNow(new Date(lastSync.created_at))} ago`
                      : "No syncs yet"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sync Log Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sync History</CardTitle>
                <CardDescription>Recent synchronization events and errors</CardDescription>
              </div>
              <div className="flex gap-1">
                {(["all", "success", "error"] as FilterStatus[]).map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(f)}
                    className="capitalize"
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !filteredLogs?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No sync logs found</p>
                <p className="text-sm">
                  {filter !== "all"
                    ? `No ${filter} events. Try a different filter.`
                    : "Sync events will appear here after your first QuickBooks sync."}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Records</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {log.sync_type.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-xs text-muted-foreground">
                          {log.direction}
                        </TableCell>
                        <TableCell>
                          {log.status === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {log.records_processed}
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          {log.error_message && (
                            <span className="text-xs text-destructive truncate block" title={log.error_message}>
                              {log.error_message}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
