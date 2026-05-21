import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";
import { useEffect } from "react";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";

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
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">1099 Prep</h1>
            <p className="text-muted-foreground text-sm">Annual paid commission totals per advisor. IRS threshold {fmt(THRESHOLD)}.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !(data?.length)}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader><CardTitle>Tax year {year}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Advisor</TableHead>
                    <TableHead className="text-right">Paid commissions</TableHead>
                    <TableHead>1099 required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(r.total)}</TableCell>
                      <TableCell>{r.total >= THRESHOLD ? <Badge variant="destructive">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
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
