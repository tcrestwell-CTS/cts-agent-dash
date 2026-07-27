import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTaskRuns, useTaskRunStats } from "@/hooks/useTaskRuns";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, CheckCircle2, XCircle, Clock, Loader2, Bot, Timer, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  success: { label: "Success", variant: "default", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
  running: { label: "Running", variant: "secondary", icon: Loader2 },
  skipped: { label: "Skipped", variant: "outline", icon: Clock },
};

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  cron: { label: "Cron Job", icon: Timer, color: "text-info" },
  edge_function: { label: "Edge Function", icon: Zap, color: "text-warning" },
  ai_agent: { label: "AI Agent", icon: Bot, color: "text-primary" },
};

export default function TaskMonitor() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRun, setSelectedRun] = useState<any>(null);

  const { data: runs = [], isLoading } = useTaskRuns({
    task_type: typeFilter,
    status: statusFilter,
    limit: 200,
  });
  const { data: stats } = useTaskRunStats();

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Task Monitor</h1>
          <p className="text-muted-foreground text-sm mt-1">Track cron jobs, edge functions, and AI agent activity</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">Last 24h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{stats?.success ?? 0}</p>
              <p className="text-xs text-muted-foreground">Success</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{stats?.failed ?? 0}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-info">{stats?.running ?? 0}</p>
              <p className="text-xs text-muted-foreground">Running</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-info">{stats?.byType.cron ?? 0}</p>
              <p className="text-xs text-muted-foreground">Cron</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-warning">{stats?.byType.edge_function ?? 0}</p>
              <p className="text-xs text-muted-foreground">Functions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats?.byType.ai_agent ?? 0}</p>
              <p className="text-xs text-muted-foreground">AI Agents</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Task Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="cron">Cron Jobs</SelectItem>
              <SelectItem value="edge_function">Edge Functions</SelectItem>
              <SelectItem value="ai_agent">AI Agents</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading task runs...
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Activity className="h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">No task runs recorded yet</p>
                <p className="text-sm mt-1">Tasks will appear here as they execute</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const sc = statusConfig[run.status] || statusConfig.running;
                    const tc = typeConfig[run.task_type] || typeConfig.edge_function;
                    const StatusIcon = sc.icon;
                    const TypeIcon = tc.icon;

                    return (
                      <TableRow
                        key={run.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedRun(run)}
                      >
                        <TableCell className="font-medium">{run.task_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <TypeIcon className={`h-3.5 w-3.5 ${tc.color}`} />
                            <span className="text-xs">{tc.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sc.variant} className="gap-1">
                            <StatusIcon className={`h-3 w-3 ${run.status === "running" ? "animate-spin" : ""}`} />
                            {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger className="text-sm">
                              {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                            </TooltipTrigger>
                            <TooltipContent>{format(new Date(run.started_at), "PPpp")}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-sm">
                          {run.duration_ms != null ? (
                            run.duration_ms < 1000
                              ? `${run.duration_ms}ms`
                              : `${(run.duration_ms / 1000).toFixed(1)}s`
                          ) : run.status === "running" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                          {run.error_message || run.result_summary || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedRun?.task_name}</DialogTitle>
            </DialogHeader>
            {selectedRun && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Type:</span> {typeConfig[selectedRun.task_type]?.label}</div>
                  <div><span className="text-muted-foreground">Status:</span> {selectedRun.status}</div>
                  <div><span className="text-muted-foreground">Started:</span> {format(new Date(selectedRun.started_at), "PPpp")}</div>
                  <div><span className="text-muted-foreground">Duration:</span> {selectedRun.duration_ms ? `${selectedRun.duration_ms}ms` : "—"}</div>
                </div>
                {selectedRun.result_summary && (
                  <div>
                    <p className="text-muted-foreground mb-1">Result:</p>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">{selectedRun.result_summary}</pre>
                  </div>
                )}
                {selectedRun.error_message && (
                  <div>
                    <p className="text-destructive mb-1">Error:</p>
                    <pre className="bg-destructive/10 dark:bg-red-900/20 p-3 rounded text-xs whitespace-pre-wrap text-destructive dark:text-red-300">{selectedRun.error_message}</pre>
                  </div>
                )}
                {selectedRun.metadata && Object.keys(selectedRun.metadata).length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1">Metadata:</p>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">{JSON.stringify(selectedRun.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
