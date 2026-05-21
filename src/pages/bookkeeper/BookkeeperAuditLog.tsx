import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useBookkeeperAuditLog } from "@/hooks/useBookkeeperAudit";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";

function useActorNames() {
  return useQuery({
    queryKey: ["bookkeeper-audit-actors"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bookkeeper_profiles_view")
        .select("user_id, full_name");
      const m = new Map<string, string>();
      for (const p of data ?? []) m.set(p.user_id, p.full_name || "Unknown");
      return m;
    },
  });
}

export default function BookkeeperAuditLog() {
  const { data, isLoading } = useBookkeeperAuditLog(300);
  const { data: actors } = useActorNames();

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="space-y-1">
          <BookkeeperBreadcrumb page="Audit Log" />
          <h1 className="text-3xl font-semibold">Audit Log</h1>
          <p className="text-muted-foreground text-sm">Recent bookkeeper actions (page views, exports).</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Last 300 events</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                      <TableCell className="text-sm">{actors?.get(r.actor_id) ?? r.actor_id.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.resource ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {r.metadata ? JSON.stringify(r.metadata) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No activity yet.</TableCell></TableRow>
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