import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, DollarSign, AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV, formatCurrencyForExport, formatDateForExport } from "@/lib/csvExport";
import { format } from "date-fns";
import { Link } from "react-router-dom";

type Row = {
  booking_id: string;
  trip_id: string | null;
  trip_name: string | null;
  departure_date: string | null;
  return_date: string | null;
  client_id: string | null;
  client_name: string;
  supplier_id: string | null;
  supplier_name: string;
  confirmation_number: string | null;
  gross_sales: number;
  supplier_payout: number;
  client_paid: number;
  client_paid_in_full: boolean;
  supplier_paid_status: string;
};

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function SupplierPaymentsDue() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "waiting" | "paid">("ready");

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-payments-due"],
    queryFn: async (): Promise<Row[]> => {
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(`
          id, trip_id, supplier_id, confirmation_number,
          gross_sales, supplier_payout, supplier_paid_status,
          status,
          trips:trip_id ( id, trip_name, departure_date, return_date, client_id, clients:client_id ( id, name ) ),
          suppliers:supplier_id ( id, name )
        `)
        .not("status", "in", "(cancelled,archived)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const tripIds = Array.from(new Set((bookings || []).map((b: any) => b.trip_id).filter(Boolean)));

      // Sum paid client payments per trip
      const paidByTrip = new Map<string, number>();
      if (tripIds.length) {
        const { data: pays } = await supabase
          .from("trip_payments")
          .select("trip_id, amount, status")
          .in("trip_id", tripIds)
          .eq("status", "paid");
        (pays || []).forEach((p: any) => {
          if (!p.trip_id) return;
          paidByTrip.set(p.trip_id, (paidByTrip.get(p.trip_id) || 0) + Number(p.amount || 0));
        });
      }

      // Sum gross sales per trip (for paid-in-full comparison)
      const grossByTrip = new Map<string, number>();
      (bookings || []).forEach((b: any) => {
        if (!b.trip_id) return;
        grossByTrip.set(b.trip_id, (grossByTrip.get(b.trip_id) || 0) + Number(b.gross_sales || 0));
      });

      return (bookings || []).map((b: any): Row => {
        const tripGross = b.trip_id ? grossByTrip.get(b.trip_id) || 0 : Number(b.gross_sales || 0);
        const tripPaid = b.trip_id ? paidByTrip.get(b.trip_id) || 0 : 0;
        const paidInFull = tripGross > 0 && tripPaid >= tripGross - 0.01;
        return {
          booking_id: b.id,
          trip_id: b.trip_id,
          trip_name: b.trips?.trip_name ?? null,
          departure_date: b.trips?.departure_date ?? null,
          return_date: b.trips?.return_date ?? null,
          client_id: b.trips?.client_id ?? null,
          client_name: b.trips?.clients?.name ?? "—",
          supplier_id: b.supplier_id,
          supplier_name: b.suppliers?.name ?? "—",
          confirmation_number: b.confirmation_number,
          gross_sales: Number(b.gross_sales || 0),
          supplier_payout: Number(b.supplier_payout || 0),
          client_paid: tripPaid,
          client_paid_in_full: paidInFull,
          supplier_paid_status: b.supplier_paid_status || "unpaid",
        };
      });
    },
  });

  const filtered = useMemo(() => {
    const rows = data || [];
    return rows.filter((r) => {
      if (statusFilter === "paid" && r.supplier_paid_status !== "paid") return false;
      if (statusFilter === "ready" && (r.supplier_paid_status === "paid" || !r.client_paid_in_full)) return false;
      if (statusFilter === "waiting" && (r.supplier_paid_status === "paid" || r.client_paid_in_full)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.client_name} ${r.trip_name ?? ""} ${r.supplier_name} ${r.confirmation_number ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, statusFilter, search]);

  const totals = useMemo(() => {
    const due = filtered.filter((r) => r.supplier_paid_status !== "paid");
    const ready = due.filter((r) => r.client_paid_in_full);
    return {
      readyCount: ready.length,
      readyAmount: ready.reduce((s, r) => s + r.supplier_payout, 0),
      waitingCount: due.length - ready.length,
      waitingAmount: due.filter((r) => !r.client_paid_in_full).reduce((s, r) => s + r.supplier_payout, 0),
    };
  }, [filtered]);

  const handleExport = () => {
    exportToCSV(
      filtered.map((r) => ({
        client: r.client_name,
        trip: r.trip_name ?? "",
        departure_date: r.departure_date ? formatDateForExport(r.departure_date) : "",
        return_date: r.return_date ? formatDateForExport(r.return_date) : "",
        supplier: r.supplier_name,
        confirmation: r.confirmation_number ?? "",
        gross_sales: formatCurrencyForExport(r.gross_sales),
        client_paid: formatCurrencyForExport(r.client_paid),
        paid_in_full: r.client_paid_in_full ? "Yes" : "No",
        supplier_payout_due: formatCurrencyForExport(r.supplier_payout),
        supplier_paid_status: r.supplier_paid_status,
      })),
      `supplier-payments-due-${format(new Date(), "yyyy-MM-dd")}`
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Supplier Payments Due</h1>
            <p className="text-muted-foreground mt-1">
              Payments owed to suppliers, grouped by client trip. "Ready to pay" means the client has paid in full.
            </p>
          </div>
          <Button onClick={handleExport} disabled={!filtered.length} variant="outline">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Ready to pay
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currency(totals.readyAmount)}</div>
              <p className="text-xs text-muted-foreground">{totals.readyCount} booking(s) — client paid in full</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Waiting on client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currency(totals.waitingAmount)}</div>
              <p className="text-xs text-muted-foreground">{totals.waitingCount} booking(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Total outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currency(totals.readyAmount + totals.waitingAmount)}</div>
              <p className="text-xs text-muted-foreground">All unpaid supplier payouts</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search client, trip, supplier, confirmation…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ready">Ready to pay</SelectItem>
                  <SelectItem value="waiting">Waiting on client</SelectItem>
                  <SelectItem value="paid">Already paid</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No bookings match the current filter.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Trip</TableHead>
                      <TableHead>Departure</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Confirmation</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Client Paid</TableHead>
                      <TableHead className="text-right">Payout Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.booking_id}>
                        <TableCell className="font-medium">{r.client_name}</TableCell>
                        <TableCell>
                          {r.trip_id ? (
                            <Link to={`/trips/${r.trip_id}`} className="text-primary hover:underline">
                              {r.trip_name ?? "Untitled trip"}
                            </Link>
                          ) : (
                            r.trip_name ?? "—"
                          )}
                        </TableCell>
                        <TableCell>{r.departure_date ? format(new Date(r.departure_date + "T00:00:00"), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>{r.supplier_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.confirmation_number ?? "—"}</TableCell>
                        <TableCell className="text-right">{currency(r.gross_sales)}</TableCell>
                        <TableCell className="text-right">{currency(r.client_paid)}</TableCell>
                        <TableCell className="text-right font-semibold">{currency(r.supplier_payout)}</TableCell>
                        <TableCell>
                          {r.supplier_paid_status === "paid" ? (
                            <Badge variant="outline" className="bg-muted">Paid</Badge>
                          ) : r.client_paid_in_full ? (
                            <Badge className="bg-green-600 hover:bg-green-700">Ready to pay</Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500 text-amber-700">Waiting on client</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}