// Recon Sync Status Panel — last QBO cache sync run + recent failures
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Database, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type AuditRow = {
  id: string;
  created_at: string;
  after_state: Record<string, string> | null;
};

type DLQRow = {
  id: string;
  created_at: string;
  error_message: string | null;
  payload: Record<string, unknown> | null;
};

export function SyncStatusPanel() {
  const { data: lastSuccess, isLoading: loadingSuccess } = useQuery({
    queryKey: ["recon-last-sync-success"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recon_audit_log")
        .select("id, created_at, after_state")
        .eq("action", "qbo_cache_sync")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AuditRow | null;
    },
    refetchInterval: 30_000,
  });

  const { data: failures, isLoading: loadingFailures } = useQuery({
    queryKey: ["recon-sync-failures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recon_dead_letter_queue")
        .select("id, created_at, error_message, payload")
        .eq("event_type", "cache_sync")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as DLQRow[];
    },
    refetchInterval: 30_000,
  });

  const lastFailure = failures?.[0];
  const successAt = lastSuccess?.created_at ? new Date(lastSuccess.created_at) : null;
  const failureAt = lastFailure?.created_at ? new Date(lastFailure.created_at) : null;
  const lastWasSuccess =
    successAt && (!failureAt || successAt.getTime() >= failureAt.getTime());

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              QBO Cache Sync Status
            </CardTitle>
            <CardDescription>
              Last sync run and recent failures from the QBO cache pipeline
            </CardDescription>
          </div>
          {loadingSuccess || loadingFailures ? (
            <Skeleton className="h-6 w-24" />
          ) : lastWasSuccess ? (
            <Badge className="bg-success/10 text-success border-success/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Healthy
            </Badge>
          ) : lastFailure ? (
            <Badge className="bg-destructive/10 text-destructive border-destructive/20">
              <XCircle className="h-3 w-3 mr-1" />
              Last run failed
            </Badge>
          ) : (
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              Never run
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last successful run */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Last Successful Sync
          </p>
          {loadingSuccess ? (
            <Skeleton className="h-5 w-48" />
          ) : successAt ? (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">
                  {formatDistanceToNow(successAt, { addSuffix: true })}
                </span>
                <span className="text-muted-foreground ml-2 text-xs">
                  · {format(successAt, "MMM d, yyyy h:mm a")}
                </span>
              </p>
              {lastSuccess?.after_state && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(lastSuccess.after_state).map(([k, v]) => (
                    <Badge key={k} variant="outline" className="text-xs font-normal">
                      {k}: {v}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No successful syncs recorded yet.</p>
          )}
        </div>

        {/* Recent failures */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Recent Failures
          </p>
          {loadingFailures ? (
            <Skeleton className="h-12 w-full" />
          ) : failures && failures.length > 0 ? (
            <ul className="space-y-2">
              {failures.map((f) => (
                <li
                  key={f.id}
                  className="text-sm border border-destructive/20 bg-destructive/10/50 rounded-md p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-destructive">
                      {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(f.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  {f.error_message && (
                    <p className="text-xs text-destructive mt-1 break-words">
                      {f.error_message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No failures recorded. 🎉</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}