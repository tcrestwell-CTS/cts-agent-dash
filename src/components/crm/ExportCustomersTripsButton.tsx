import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV, formatCurrencyForExport, formatDateForExport } from "@/lib/csvExport";
import { toast } from "@/hooks/use-toast";

type Row = {
  client_name: string;
  client_email: string;
  client_phone: string;
  client_status: string;
  trip_name: string;
  trip_status: string;
  trip_phase: string;
  departure_date: string;
  return_date: string;
  bookings_count: number;
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

      const rows: Row[] = (tripsRes.data || []).map((t: any) => {
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
          client_name: client?.name || "—",
          client_email: client?.email || "",
          client_phone: client?.phone || "",
          client_status: toTitleCase(client?.status),
          trip_name: t.trip_name || "",
          trip_status: toTitleCase(t.status),
          trip_phase: phase,
          departure_date: t.departure_date ? formatDateForExport(t.departure_date) : "",
          return_date: t.return_date ? formatDateForExport(t.return_date) : "",
          bookings_count: totals.count,
          trip_total: formatCurrencyForExport(totals.total),
          trip_paid: formatCurrencyForExport(paid),
          trip_balance: formatCurrencyForExport(totals.total - paid),
        };
      });

      // Append a totals-by-customer summary block at the end of the same CSV
      const byClient = new Map<string, { name: string; email: string; status: string; trips: number; total: number; paid: number }>();
      for (const r of rows) {
        const key = `${r.client_name}|${r.client_email}`;
        const agg = byClient.get(key) || {
          name: r.client_name,
          email: r.client_email,
          status: r.client_status,
          trips: 0,
          total: 0,
          paid: 0,
        };
        agg.trips += 1;
        agg.total += Number(r.trip_total) || 0;
        agg.paid += Number(r.trip_paid) || 0;
        byClient.set(key, agg);
      }

      const summaryRows: Row[] = Array.from(byClient.values())
        .sort((a, b) => b.total - a.total)
        .map((c) => ({
          client_name: c.name,
          client_email: c.email,
          client_phone: "",
          client_status: c.status,
          trip_name: "— CUSTOMER TOTAL —",
          trip_status: "",
          trip_phase: "",
          departure_date: "",
          return_date: "",
          bookings_count: c.trips,
          trip_total: formatCurrencyForExport(c.total),
          trip_paid: formatCurrencyForExport(c.paid),
          trip_balance: formatCurrencyForExport(c.total - c.paid),
        }));

      const all = [...rows, ...summaryRows];
      if (all.length === 0) {
        toast({ title: "Nothing to export", description: "No trips found." });
        return;
      }

      const filename = `customers-trips-totals-${new Date().toISOString().split("T")[0]}`;
      exportToCSV(all, filename, [
        { key: "client_name", header: "Client Name" },
        { key: "client_email", header: "Email" },
        { key: "client_phone", header: "Phone" },
        { key: "client_status", header: "Client Status" },
        { key: "trip_name", header: "Trip" },
        { key: "trip_status", header: "Trip Status" },
        { key: "trip_phase", header: "Trip Phase" },
        { key: "departure_date", header: "Departure" },
        { key: "return_date", header: "Return" },
        { key: "bookings_count", header: "Bookings" },
        { key: "trip_total", header: "Trip Total" },
        { key: "trip_paid", header: "Paid" },
        { key: "trip_balance", header: "Balance" },
      ]);

      toast({ title: "Export ready", description: `${rows.length} trips, ${summaryRows.length} customers.` });
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