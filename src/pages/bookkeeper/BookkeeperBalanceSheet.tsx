import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PeriodLockButton } from "@/components/bookkeeper/PeriodLockButton";
import { EmptyState, BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";
import { FileText } from "lucide-react";

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
    <div className={`flex justify-between py-2 ${bold ? "border-t border-border pt-3 text-[13.5px] font-semibold text-foreground" : "text-[13.5px] text-muted-foreground"}`}>
      <span>{label}</span><span className="tabular-nums">{fmt(value)}</span>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="space-y-1">
          <BookkeeperBreadcrumb page="Balance Sheet" />
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Balance Sheet</h1>
            <PeriodLockButton year={new Date().getFullYear()} month={new Date().getMonth() + 1} />
          </div>
          <p className="text-[13.5px] text-muted-foreground">Snapshot from local data. Bank balances not included.</p>
        </div>
        {isLoading ? <Skeleton className="h-64 w-full" /> : assets === 0 && liabilities === 0 ? (
          <Panel>
            <PanelBody>
              <EmptyState icon={FileText} title="No balance sheet data" description="There are no open invoices, supplier liabilities, or paid payments yet." />
            </PanelBody>
          </Panel>
        ) : (
          <div className="grid gap-[14px] md:grid-cols-2">
            <Panel>
              <PanelHeader title="Assets" />
              <PanelBody className="gap-0">
                <Row label="Accounts Receivable (open invoices)" value={data?.ar ?? 0} />
                <Row label="Client Funds Held" value={data?.clientFunds ?? 0} />
                <Row label="Total Assets" value={assets} bold />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader title="Liabilities & Equity" />
              <PanelBody className="gap-0">
                <Row label="Accounts Payable (suppliers)" value={data?.ap ?? 0} />
                <Row label="Pending Commissions" value={data?.pendingComm ?? 0} />
                <Row label="Total Liabilities" value={liabilities} bold />
                <Row label="Equity" value={equity} bold />
              </PanelBody>
            </Panel>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
