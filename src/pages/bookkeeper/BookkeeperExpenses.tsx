import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function BookkeeperExpenses() {
  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-expenses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select("id, booking_reference, supplier_paid_amount, supplier_paid_date, supplier_paid_method, trip_id, supplier_id, trips:trip_id(trip_name), suppliers:supplier_id(name)")
        .eq("supplier_paid_status", "paid")
        .order("supplier_paid_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.supplier_paid_amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-semibold">Expenses</h1>
          <p className="text-muted-foreground text-sm">Latest 200 supplier payments.</p>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Supplier payments</CardTitle>
            {!isLoading && <div className="text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">{fmt(total)}</span></div>}
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paid</TableHead>
                    <TableHead>Trip / Booking</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.supplier_paid_date ? format(new Date(r.supplier_paid_date + "T00:00:00"), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        <div>{r.trips?.trip_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.booking_reference || ""}</div>
                      </TableCell>
                      <TableCell>{r.suppliers?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.supplier_paid_method || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(r.supplier_paid_amount || 0))}</TableCell>
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
