import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function downloadCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type Kind = "income" | "expenses" | "commissions" | "payouts";

export default function BookkeeperExport() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState<Kind | null>(null);

  const exportKind = async (kind: Kind) => {
    setLoading(kind);
    try {
      const start = `${year}-01-01`;
      const end = `${year + 1}-01-01`;
      let rows: any[] = [];
      if (kind === "income") {
        const { data, error } = await (supabase as any).from("trip_payments")
          .select("payment_date, amount, payment_type, payment_method, status, stripe_payment_intent_id, trip_id, booking_id")
          .eq("status", "paid").gte("payment_date", start).lt("payment_date", end);
        if (error) throw error;
        rows = data ?? [];
      } else if (kind === "expenses") {
        const { data, error } = await (supabase as any).from("bookings")
          .select("supplier_paid_date, supplier_paid_amount, supplier_paid_method, supplier_paid_reference, booking_reference, supplier_id, trip_id")
          .eq("supplier_paid_status", "paid").gte("supplier_paid_date", start).lt("supplier_paid_date", end);
        if (error) throw error;
        rows = data ?? [];
      } else if (kind === "commissions") {
        const { data, error } = await (supabase as any).from("commissions")
          .select("user_id, booking_id, amount, rate, status, paid_date, created_at")
          .gte("created_at", start).lt("created_at", end);
        if (error) throw error;
        rows = data ?? [];
      } else if (kind === "payouts") {
        const { data, error } = await (supabase as any).from("stripe_payouts")
          .select("stripe_payout_id, arrival_date, amount, fee_total, net_amount, status, reconciled")
          .gte("arrival_date", start).lt("arrival_date", end);
        if (error) throw error;
        rows = data ?? [];
      }
      if (!rows.length) {
        toast.info("No rows to export for that selection.");
        return;
      }
      downloadCsv(`${kind}-${year}.csv`, toCsv(rows));
      toast.success(`Exported ${rows.length} rows.`);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setLoading(null);
    }
  };

  const years = [year + 1, year, year - 1, year - 2];

  const ExportBtn = ({ kind, label }: { kind: Kind; label: string }) => (
    <Button variant="outline" disabled={loading !== null} onClick={() => exportKind(kind)}>
      {loading === kind ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Export Center</h1>
            <p className="text-muted-foreground text-sm">Download CSVs for accountant handoff.</p>
          </div>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Card>
          <CardHeader><CardTitle>Available exports</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <ExportBtn kind="income" label="Income (trip payments)" />
            <ExportBtn kind="expenses" label="Expenses (supplier payments)" />
            <ExportBtn kind="commissions" label="Commissions" />
            <ExportBtn kind="payouts" label="Stripe Payouts" />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
