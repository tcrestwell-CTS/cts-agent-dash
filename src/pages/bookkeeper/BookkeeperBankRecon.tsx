import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function BookkeeperBankRecon() {
  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-bank-recon"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stripe_payouts")
        .select("id, stripe_payout_id, amount, fee_total, net_amount, arrival_date, status, reconciled")
        .order("arrival_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="space-y-1">
          <BookkeeperBreadcrumb page="Bank Reconciliation" />
          <h1 className="text-3xl font-semibold">Bank Reconciliation</h1>
          <p className="text-muted-foreground text-sm">Stripe payouts arriving in the operating bank account.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Recent payouts</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arrival</TableHead>
                    <TableHead>Payout ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Reconciled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.arrival_date ? format(new Date(r.arrival_date + "T00:00:00"), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.stripe_payout_id}</TableCell>
                      <TableCell><Badge variant="outline">{r.status || "—"}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(Number(r.amount || 0))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(Number(r.fee_total || 0))}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(r.net_amount || 0))}</TableCell>
                      <TableCell>{r.reconciled ? <Badge>Matched</Badge> : <Badge variant="outline">Pending</Badge>}</TableCell>
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
