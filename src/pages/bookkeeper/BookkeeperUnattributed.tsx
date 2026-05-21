import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

function useUnattributed() {
  return useQuery({
    queryKey: ["bookkeeper-unattributed"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("checkout_payments")
        .select(
          "id, amount, currency, status, payment_type, stripe_payment_intent_id, created_at, customer_email, customer_name",
        )
        .eq("payment_type", "unattributed_deposit")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

const fmt = (n: number, c = "USD") =>
  Number(n).toLocaleString("en-US", { style: "currency", currency: c });

export default function BookkeeperUnattributed() {
  const { data, isLoading } = useUnattributed();

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-semibold">Unattributed Deposits</h1>
          <p className="text-muted-foreground text-sm">
            Stripe payments without a linked trip or booking. Read-only.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending review</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No unattributed deposits — everything is matched.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Stripe PI</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.created_at
                          ? format(new Date(row.created_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {row.customer_name || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.customer_email || ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        {fmt(Number(row.amount || 0), row.currency || "USD")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.stripe_payment_intent_id || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.status || "—"}</Badge>
                      </TableCell>
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