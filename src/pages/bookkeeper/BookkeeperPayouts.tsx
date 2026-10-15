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
import { isAgencyOwnerAgent } from "@/lib/agencyOwnerAgents";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function BookkeeperPayouts() {
  const logAction = useLogBookkeeperAction();
  useEffect(() => { logAction("view", "bookkeeper_payouts"); }, [logAction]);
  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-payouts"],
    queryFn: async () => {
      const [commRes, profRes, splitRes] = await Promise.all([
        (supabase as any).from("commissions").select("id, user_id, amount, status, paid_date"),
        (supabase as any).from("bookkeeper_profiles_view").select("user_id, full_name"),
        (supabase as any).from("commission_splits").select("commission_id, recipient_user_id, role, amount, status"),
      ]);
      const profiles = new Map<string, string>();
      for (const p of profRes.data ?? []) profiles.set(p.user_id, p.full_name || "Unknown");
      // Advisor share per commission: explicit agent split row wins; otherwise advisor split %.
      const agentSplits = new Map<string, { amount: number; status: string }>();
      for (const s of splitRes.data ?? []) {
        if (s.role !== "agent") continue;
        const prev = agentSplits.get(s.commission_id);
        agentSplits.set(s.commission_id, {
          amount: (prev?.amount ?? 0) + Number(s.amount || 0),
          status: s.status,
        });
      }
      const userIds = Array.from(new Set<string>((commRes.data ?? []).map((c: any) => c.user_id)));
      const pcts = new Map<string, number>();
      await Promise.all(userIds.map(async (uid) => {
        const { data: pct } = await (supabase as any).rpc("get_advisor_split_pct", { p_user_id: uid });
        pcts.set(uid, Number(pct ?? 0.7));
      }));
      const map = new Map<string, { name: string; paid: number; pending: number; count: number }>();
      let agencyRetained = 0;
      for (const c of commRes.data ?? []) {
        // Owner commissions stay with the agency — never an advisor payout.
        if (isAgencyOwnerAgent(c.user_id)) {
          agencyRetained += Number(c.amount || 0);
          continue;
        }
        const split = agentSplits.get(c.id);
        const gross = Number(c.amount || 0);
        const share = split ? split.amount : gross * (pcts.get(c.user_id) ?? 0.7);
        agencyRetained += gross - share;
        const e = map.get(c.user_id) || { name: profiles.get(c.user_id) || "Unknown", paid: 0, pending: 0, count: 0 };
        const paidOut = split ? split.status === "paid" : c.status === "paid";
        if (paidOut) e.paid += share;
        else e.pending += share;
        e.count += 1;
        map.set(c.user_id, e);
      }
      const rows = Array.from(map.entries())
        .map(([user_id, v]) => ({ user_id, ...v }))
        .sort((a, b) => b.paid + b.pending - (a.paid + a.pending));
      return { rows, agencyRetained };
    },
  });

  const rows = data?.rows ?? [];
  const agencyRetained = data?.agencyRetained ?? 0;

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_payouts", { rows: rows.length });
    exportToCSV(
      rows.map((r) => ({
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
            <p className="text-[13.5px] text-muted-foreground">
              Commission paid and pending, by advisor. Owner commission is agency revenue and is
              excluded{agencyRetained > 0 ? ` (${fmt(agencyRetained)} retained)` : ""}.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !rows.length} className="text-[13px]">
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>
        <Panel>
          <PanelHeader title="By advisor" />
          <PanelBody>
            {isLoading ? <Skeleton className="h-48 w-full" /> : rows.length === 0 ? (
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
                  {rows.map((r) => (
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
