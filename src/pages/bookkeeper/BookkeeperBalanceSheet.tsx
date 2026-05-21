import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function BookkeeperBalanceSheet() {
  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-balance-sheet"],
    queryFn: async () => {
      const [arRes, apRes, cfRes, pcRes] = await Promise.all([
        (supabase as any).from("invoices").select("amount_remaining").in("status", ["sent", "partial"]),
        (supabase as any).from("bookings").select("supplier_payout").eq("supplier_paid_status", "unpaid"),
        (supabase as any).from("trip_payments").select("amount").eq("status", "paid"),
        (supabase as any).from("commissions").select("amount").eq("status", "pending"),
      ]);
      const ar = (arRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_remaining || 0), 0);
      const ap = (apRes.data ?? []).reduce((s: number, r: any) => s + Number(r.supplier_payout || 0), 0);
      const clientFunds = (cfRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const pendingComm = (pcRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      return { ar, ap, clientFunds, pendingComm };
    },
  });

  const assets = (data?.ar ?? 0) + (data?.clientFunds ?? 0);
  const liabilities = (data?.ap ?? 0) + (data?.pendingComm ?? 0);
  const equity = assets - liabilities;

  const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
    <div className={`flex justify-between py-2 ${bold ? "border-t font-semibold" : "text-sm"}`}>
      <span>{label}</span><span>{fmt(value)}</span>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-semibold">Balance Sheet</h1>
          <p className="text-muted-foreground text-sm">Snapshot from local data. Bank balances not included.</p>
        </div>
        {isLoading ? <Skeleton className="h-64 w-full" /> : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
              <CardContent>
                <Row label="Accounts Receivable (open invoices)" value={data?.ar ?? 0} />
                <Row label="Client Funds Held" value={data?.clientFunds ?? 0} />
                <Row label="Total Assets" value={assets} bold />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Liabilities & Equity</CardTitle></CardHeader>
              <CardContent>
                <Row label="Accounts Payable (suppliers)" value={data?.ap ?? 0} />
                <Row label="Pending Commissions" value={data?.pendingComm ?? 0} />
                <Row label="Total Liabilities" value={liabilities} bold />
                <Row label="Equity" value={equity} bold />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
