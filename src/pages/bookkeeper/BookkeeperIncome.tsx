import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function BookkeeperIncome() {
  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-income"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("trip_payments")
        .select("id, amount, payment_date, payment_method, payment_type, status, stripe_payment_intent_id, trip_id, trips:trip_id(trip_name)")
        .eq("status", "paid")
        .order("payment_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-semibold">Income</h1>
          <p className="text-muted-foreground text-sm">Latest 200 paid client payments.</p>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Paid payments</CardTitle>
            {!isLoading && <div className="text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">{fmt(total)}</span></div>}
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Trip</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.payment_date ? format(new Date(r.payment_date + "T00:00:00"), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="max-w-xs truncate">{r.trips?.trip_name || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{r.payment_type || "payment"}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.payment_method || (r.stripe_payment_intent_id ? "stripe" : "—")}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(r.amount || 0))}</TableCell>
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
