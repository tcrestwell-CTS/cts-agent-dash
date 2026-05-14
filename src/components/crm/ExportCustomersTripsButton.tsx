import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV, formatCurrencyForExport, formatDateForExport } from "@/lib/csvExport";
import { toast } from "@/hooks/use-toast";

type Row = {
  client_name: string;
  client_email: string;
  trip_name: string;
  departure_date: string;
  trip_status: string;
  trip_total: string;
  trip_paid: string;
  trip_balance: string;
};

const toTitleCase = (s: string | null | undefined): string => {
  if (!s) return "";
  return String(s)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export function ExportCustomersTripsButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const [clientsRes, tripsRes, bookingsRes, paymentsRes] = await Promise.all([
        supabase.from("clients").select("id, name, email, phone, status").limit(10000),
        supabase
          .from("trips")
          .select("id, client_id, trip_name, status, departure_date, return_date")
          .limit(10000),
        supabase.from("bookings").select("trip_id, total_price").limit(10000),
        supabase
          .from("trip_payments")
          .select("trip_id, amount, status")
          .limit(10000),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (tripsRes.error) throw tripsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const clientsById = new Map<string, any>(
        (clientsRes.data || []).map((c: any) => [c.id, c]),
      );

      const totalsByTrip = new Map<string, { count: number; total: number }>();
      for (const b of bookingsRes.data || []) {
        const t = totalsByTrip.get(b.trip_id) || { count: 0, total: 0 };
        t.count += 1;
        t.total += Number(b.total_price) || 0;
        totalsByTrip.set(b.trip_id, t);
      }

      const paidByTrip = new Map<string, number>();
      for (const p of paymentsRes.data || []) {
        if (p.status !== "paid" && p.status !== "completed" && p.status !== "succeeded") continue;
        paidByTrip.set(p.trip_id, (paidByTrip.get(p.trip_id) || 0) + (Number(p.amount) || 0));
      }

      const allRows: Row[] = (tripsRes.data || []).map((t: any) => {
        const client = t.client_id ? clientsById.get(t.client_id) : null;
        const totals = totalsByTrip.get(t.id) || { count: 0, total: 0 };
        const paid = paidByTrip.get(t.id) || 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const ret = t.return_date ? new Date(t.return_date + "T00:00:00") : null;
        const dep = t.departure_date ? new Date(t.departure_date + "T00:00:00") : null;
        let phase = "Upcoming";
        if (t.status === "archived" || t.status === "cancelled") phase = "Archived";
        else if (ret && ret < today) phase = "Past";
        else if (dep && dep <= today && (!ret || ret >= today)) phase = "Active";
        return {
          _phase: phase,
          client_name: client?.name || "—",
          client_email: client?.email || "",
          trip_name: t.trip_name || "",
          departure_date: t.departure_date ? formatDateForExport(t.departure_date) : "",
          trip_status: toTitleCase(t.status),
          trip_total: formatCurrencyForExport(totals.total),
          trip_paid: formatCurrencyForExport(paid),
          trip_balance: formatCurrencyForExport(totals.total - paid),
        } as Row & { _phase: string };
      });

      // Only include Active and Past trips in this report
      const rows: Row[] = (allRows as any[])
        .filter((r) => r._phase === "Active" || r._phase === "Past")
        .map(({ _phase, ...rest }) => rest as Row)
        .sort((a, b) =>
          a.client_name.localeCompare(b.client_name) ||
          a.departure_date.localeCompare(b.departure_date),
        );

      if (rows.length === 0) {
        toast({ title: "Nothing to export", description: "No trips found." });
        return;
      }

      const filename = `customers-trips-totals-${new Date().toISOString().split("T")[0]}`;
      exportToCSV(rows, filename, [
        { key: "client_name", header: "Client Name" },
        { key: "client_email", header: "Email" },
        { key: "trip_name", header: "Trip" },
        { key: "departure_date", header: "Departure" },
        { key: "trip_status", header: "Trip Status" },
        { key: "trip_total", header: "Trip Total" },
        { key: "trip_paid", header: "Paid" },
        { key: "trip_balance", header: "Balance" },
      ]);

      toast({ title: "Export ready", description: `${rows.length} trips exported.` });
    } catch (e: any) {
      console.error("Export failed", e);
      toast({ title: "Export failed", description: e.message || "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleExport} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Export CSV
    </Button>
  );
}