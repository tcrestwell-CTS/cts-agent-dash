import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, RefreshCw, XCircle, Clock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import AgentHealthPanel from "@/components/AgentHealthPanel";

type AlertType = "missing_invoice" | "unpaid_balance" | "deposit_overdue" | "status_mismatch" | "commission_variance" | "qbo_desync";

const ALERT_TYPE_LABELS: Record<string, string> = {
  missing_invoice: "Missing Invoice",
  unpaid_balance: "Unpaid Balance",
  deposit_overdue: "Deposit Overdue",
  status_mismatch: "Status Mismatch",
  commission_variance: "Commission Variance",
  qbo_desync: "QBO Desync",
};

function useReconciliationAlerts(resolved: boolean) {
  return useQuery({
    queryKey: ["reconciliation_alerts", resolved],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconciliation_alerts")
        .select("*")
        .eq("resolved", resolved)
        .order("severity", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function AlertCard({
  alert,
  onAction,
}: {
  alert: {
    id: string;
    alert_type: string;
    severity: string;
    entity_id: string | null;
    entity_type: string;
    title: string;
    description: string | null;
    metadata: unknown;
    resolved: boolean;
    created_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
  };
  onAction: (id: string, action: "resolve" | "dismiss") => void;
}) {
  const isCritical = alert.severity === "critical";

  return (
    <Card className={cn("border-l-4 transition-colors", isCritical ? "border-l-destructive" : "border-l-warning")}>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isCritical ? (
              <Badge variant="destructive" className="text-xs">🔴 CRITICAL</Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-warning text-warning">⚠️ WARNING</Badge>
            )}
            <Badge variant="outline" className="text-xs capitalize">{alert.entity_type}</Badge>
          </div>
          <p className="font-semibold text-sm text-foreground">
            {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.title}
          </p>
          <p className="text-sm text-muted-foreground">{alert.description ?? alert.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
          </p>
        </div>
        {!alert.resolved && (
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => onAction(alert.id, "resolve")}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAction(alert.id, "dismiss")}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Dismiss
            </Button>
          </div>
        )}
        {alert.resolved && (
          <Badge variant="secondary" className="text-xs shrink-0">
            Resolved {alert.resolved_at && `· ${format(new Date(alert.resolved_at), "MMM d")}`}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default function Kandi() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: openAlerts = [], isLoading: loadingOpen } = useReconciliationAlerts(false);
  const { data: closedAlerts = [], isLoading: loadingClosed } = useReconciliationAlerts(true);
  const [sweeping, setSweeping] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const criticalCount = openAlerts.filter((a) => a.severity === "critical").length;
  const warningCount = openAlerts.filter((a) => a.severity === "warning").length;

  const handleAction = useCallback(
    async (id: string, action: "resolve" | "dismiss") => {
      const { error } = await supabase
        .from("reconciliation_alerts")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: action === "resolve" ? (user?.email ?? "agent") : "dismissed",
        })
        .eq("id", id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: action === "resolve" ? "Alert resolved" : "Alert dismissed" });
      queryClient.invalidateQueries({ queryKey: ["reconciliation_alerts"] });
    },
    [user, queryClient]
  );

  const runSweep = useCallback(async () => {
    setSweeping(true);
    try {
      const { data, error } = await supabase.functions.invoke("kandi", {
        body: { trigger: "daily_sweep" },
      });
      if (error) throw error;
      const result = data as { ok: boolean; alerts_raised?: number } | null;
      toast({
        title: "Sweep complete",
        description: result?.alerts_raised
          ? `${result.alerts_raised} new alert(s) found`
          : "All clear — no new alerts",
      });
      queryClient.invalidateQueries({ queryKey: ["reconciliation_alerts"] });
    } catch (err: unknown) {
      toast({
        title: "Sweep failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSweeping(false);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000);
    }
  }, [queryClient]);

  const criticals = openAlerts.filter((a) => a.severity === "critical");
  const warnings = openAlerts.filter((a) => a.severity === "warning");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Agents Health</h1>
            <p className="text-sm text-muted-foreground">Agent monitoring & reconciliation dashboard</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={runSweep} disabled={sweeping || cooldown} size="sm">
              <RefreshCw className={cn("h-4 w-4 mr-1.5", sweeping && "animate-spin")} />
              {sweeping ? "Running…" : "Run Sweep"}
            </Button>
            {criticalCount > 0 && (
              <Badge variant="destructive">🔴 {criticalCount} Critical</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="border-warning text-warning">
                ⚠️ {warningCount} Warning
              </Badge>
            )}
          </div>
        </div>

        {/* Agent Health */}
        <AgentHealthPanel />

        {/* Tabs */}
        <Tabs defaultValue="open">
          <TabsList>
            <TabsTrigger value="open">
              Open Alerts
              {openAlerts.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">{openAlerts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="h-3.5 w-3.5 mr-1" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-6 mt-4">
            {loadingOpen ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ) : openAlerts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldCheck className="h-12 w-12 text-primary mb-3" />
                  <p className="text-lg font-semibold text-foreground">No open alerts</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Everything looks clean. All agents are monitoring.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {criticals.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" /> Critical ({criticals.length})
                    </h2>
                    {criticals.map((a) => (
                      <AlertCard key={a.id} alert={a} onAction={handleAction} />
                    ))}
                  </div>
                )}
                {warnings.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" /> Warnings ({warnings.length})
                    </h2>
                    {warnings.map((a) => (
                      <AlertCard key={a.id} alert={a} onAction={handleAction} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {loadingClosed ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ) : closedAlerts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">No resolved or dismissed alerts yet.</p>
                </CardContent>
              </Card>
            ) : (
              closedAlerts.map((a) => (
                <AlertCard key={a.id} alert={a} onAction={handleAction} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
