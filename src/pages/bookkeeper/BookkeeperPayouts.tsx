import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";
import { useEffect } from "react";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { PeriodLockButton } from "@/components/bookkeeper/PeriodLockButton";
import { EmptyState, BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";
import { Wallet } from "lucide-react";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function BookkeeperPayouts() {
  const logAction = useLogBookkeeperAction();
  useEffect(() => { logAction("view", "bookkeeper_payouts"); }, [logAction]);
  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-payouts"],
    queryFn: async () => {
      const [commRes, profRes] = await Promise.all([
        (supabase as any).from("commissions").select("user_id, amount, status, paid_date"),
        (supabase as any).from("bookkeeper_profiles_view").select("user_id, full_name"),
      ]);
      const profiles = new Map<string, string>();
      for (const p of profRes.data ?? []) profiles.set(p.user_id, p.full_name || "Unknown");
      const map = new Map<string, { name: string; paid: number; pending: number; count: number }>();
      for (const c of commRes.data ?? []) {
        const e = map.get(c.user_id) || { name: profiles.get(c.user_id) || "Unknown", paid: 0, pending: 0, count: 0 };
        if (c.status === "paid") e.paid += Number(c.amount || 0);
        else e.pending += Number(c.amount || 0);
        e.count += 1;
        map.set(c.user_id, e);
      }
      return Array.from(map.entries()).map(([user_id, v]) => ({ user_id, ...v })).sort((a, b) => b.paid + b.pending - (a.paid + a.pending));
    },
  });

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_payouts", { rows: data?.length ?? 0 });
    exportToCSV(
      (data ?? []).map((r) => ({
        advisor: r.name,
        user_id: r.user_id,
        commissions: r.count,
        pending: r.pending.toFixed(2),
        paid: r.paid.toFixed(2),
      })),
      `bookkeeper-payouts-${new Date().toISOString().slice(0, 10)}`,
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <BookkeeperBreadcrumb page="Agent Payouts" />
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Agent Payouts</h1>
              <PeriodLockButton year={new Date().getFullYear()} month={new Date().getMonth() + 1} />
            </div>
            <p className="text-[13.5px] text-muted-foreground">Commission paid and pending, by advisor.</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !(data?.length)} className="text-[13px]">
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>
        <Panel>
          <PanelHeader title="By advisor" />
          <PanelBody>
            {isLoading ? <Skeleton className="h-48 w-full" /> : (data?.length ?? 0) === 0 ? (
              <EmptyState icon={Wallet} title="No agent commissions yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Advisor</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Commissions</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Pending</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell className="text-[13.5px]">{r.name}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center rounded-full border border-border px-[9px] py-[2px] text-[11.5px] font-medium text-muted-foreground tabular-nums">
                          {r.count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-[14px] tabular-nums">{fmt(r.pending)}</TableCell>
                      <TableCell className="text-right text-[14px] font-semibold tabular-nums">{fmt(r.paid)}</TableCell>
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
