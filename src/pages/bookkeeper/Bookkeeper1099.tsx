import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { BookkeeperHeader, EmptyState, TableSkeleton, MoneyCell } from "@/components/bookkeeper/shared";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { SemanticStatusPill } from "@/components/patterns/StatusPill";
import { isAgencyOwnerAgent } from "@/lib/agencyOwnerAgents";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
const THRESHOLD = 600;

export default function Bookkeeper1099() {
  const [year, setYear] = useState(new Date().getFullYear());
  const logAction = useLogBookkeeperAction();
  useEffect(() => { logAction("view", "bookkeeper_1099", { year }); }, [logAction, year]);

  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-1099", year],
    queryFn: async () => {
      const start = `${year}-01-01`;
      const end = `${year + 1}-01-01`;
      const [commRes, profRes] = await Promise.all([
        (supabase as any).from("commissions").select("user_id, amount, paid_date, status").eq("status", "paid").gte("paid_date", start).lt("paid_date", end),
        (supabase as any).from("bookkeeper_profiles_view").select("user_id, full_name"),
      ]);
      const profiles = new Map<string, string>();
      for (const p of profRes.data ?? []) profiles.set(p.user_id, p.full_name || "Unknown");
      const map = new Map<string, { name: string; total: number }>();
      for (const c of commRes.data ?? []) {
        // Owner commissions are agency revenue, not advisor payouts — no 1099.
        if (isAgencyOwnerAgent(c.user_id)) continue;
        const e = map.get(c.user_id) || { name: profiles.get(c.user_id) || "Unknown", total: 0 };
        e.total += Number(c.amount || 0);
        map.set(c.user_id, e);
      }
      return Array.from(map.entries()).map(([user_id, v]) => ({ user_id, ...v })).sort((a, b) => b.total - a.total);
    },
  });

  const years = [year + 1, year, year - 1, year - 2, year - 3];

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_1099", { year });
    exportToCSV(
      (data ?? []).map((r) => ({
        advisor: r.name,
        user_id: r.user_id,
        paid_commissions: r.total.toFixed(2),
        requires_1099: r.total >= THRESHOLD ? "yes" : "no",
      })),
      `bookkeeper-1099-${year}`,
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <BookkeeperHeader
          title="1099 Prep"
          description={`Annual paid commission totals per advisor. IRS threshold ${fmt(THRESHOLD)}.`}
          year={year}
          month={12}
          actions={
            <>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-32 text-[13.5px]"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !(data?.length)} className="text-[13px]">
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            </>
          }
        />
        <Panel>
          <PanelHeader title={`Tax year ${year}`} />
          <PanelBody>
            {isLoading ? (
              <TableSkeleton rows={6} cols={3} />
            ) : (data?.length ?? 0) === 0 ? (
              <EmptyState icon={FileSpreadsheet} title={`No paid commissions in ${year}`} description="Switch tax years to view earlier data." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Advisor</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Paid commissions</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">1099 required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell className="text-[14px]">{r.name}</TableCell>
                      <MoneyCell value={r.total} bold />
                      <TableCell>
                        {r.total >= THRESHOLD ? (
                          <SemanticStatusPill status="destructive" label="Yes" />
                        ) : (
                          <SemanticStatusPill status="muted" label="No" />
                        )}
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
