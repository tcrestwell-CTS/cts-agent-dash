import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";
import { useEffect } from "react";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { PeriodLockButton } from "@/components/bookkeeper/PeriodLockButton";
import { EmptyState } from "@/components/bookkeeper/shared";
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
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-semibold">Agent Payouts</h1>
              <PeriodLockButton year={new Date().getFullYear()} month={new Date().getMonth() + 1} />
            </div>
            <p className="text-muted-foreground text-sm">Commission paid and pending, by advisor.</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !(data?.length)}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>
        <Card>
          <CardHeader><CardTitle>By advisor</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : (data?.length ?? 0) === 0 ? (
              <EmptyState icon={Wallet} title="No agent commissions yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Advisor</TableHead>
                    <TableHead className="text-right">Commissions</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right"><Badge variant="outline">{r.count}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.pending)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmt(r.paid)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
