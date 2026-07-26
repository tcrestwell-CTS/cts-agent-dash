import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useBookkeeperAuditLog } from "@/hooks/useBookkeeperAudit";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookkeeperBreadcrumb, EmptyState } from "@/components/bookkeeper/shared";
import { ClipboardList } from "lucide-react";

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
      <div className="space-y-[18px]">
        <div className="space-y-1">
          <BookkeeperBreadcrumb page="Audit Log" />
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Audit Log</h1>
          <p className="text-[13.5px] text-muted-foreground">Recent bookkeeper actions (page views, exports).</p>
        </div>
        <Panel>
          <PanelHeader title="Last 300 events" />
          <PanelBody>
            {isLoading ? <Skeleton className="h-64 w-full" /> : (data ?? []).length === 0 ? (
              <EmptyState icon={ClipboardList} title="No activity yet" description="Bookkeeper actions will appear here as they happen." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">When</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">User</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Action</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Resource</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-[13.5px]">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                      <TableCell className="text-[13.5px]">{actors?.get(r.actor_id) ?? r.actor_id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full border border-border px-[9px] py-[2px] text-[11.5px] font-medium capitalize text-muted-foreground">
                          {r.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-[13.5px] text-muted-foreground">{r.resource ?? "—"}</TableCell>
                      <TableCell className="max-w-md truncate text-[12.5px] text-muted-foreground">
                        {r.metadata ? JSON.stringify(r.metadata) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
      </div>
    </DashboardLayout>
  );
}