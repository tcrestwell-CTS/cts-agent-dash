import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2 } from "lucide-react";
import { exportToCSV } from "@/lib/csvExport";
import { useEffect } from "react";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { BookkeeperHeader, EmptyState, TableSkeleton } from "@/components/bookkeeper/shared";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";

function useUnattributed() {
  return useQuery({
    queryKey: ["bookkeeper-unattributed"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("checkout_payments")
        .select(
          "id, amount_cents, currency, status, payment_type, stripe_payment_intent_id, created_at, customer_email, customer_name",
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
  const logAction = useLogBookkeeperAction();
  useEffect(() => { logAction("view", "bookkeeper_unattributed"); }, [logAction]);

  const exportCsv = () => {
    logAction("export_csv", "bookkeeper_unattributed", { rows: data?.length ?? 0 });
    exportToCSV(
      (data ?? []).map((r: any) => ({
        created_at: r.created_at,
        customer_name: r.customer_name ?? "",
        customer_email: r.customer_email ?? "",
        amount: (Number(r.amount_cents || 0) / 100).toFixed(2),
        currency: r.currency ?? "USD",
        stripe_payment_intent_id: r.stripe_payment_intent_id ?? "",
        status: r.status ?? "",
      })),
      `bookkeeper-unattributed-${new Date().toISOString().slice(0, 10)}`,
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <BookkeeperHeader
          title="Unattributed Deposits"
          description="Stripe payments without a linked trip or booking. Read-only."
          year={new Date().getFullYear()}
          month={new Date().getMonth() + 1}
          actions={
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading || !(data?.length)} className="text-[13px]">
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
          }
        />

        <Panel>
          <PanelHeader title="Pending review" />
          <PanelBody>
            {isLoading ? (
              <TableSkeleton rows={4} cols={5} />
            ) : (data?.length ?? 0) === 0 ? (
              <EmptyState icon={CheckCircle2} title="All deposits matched" description="No unattributed Stripe payments to review." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Date</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Customer</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Amount</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Stripe PI</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-[14px]">
                        {row.created_at
                          ? format(new Date(row.created_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="text-[14px]">
                          {row.customer_name || "—"}
                        </div>
                        <div className="text-[12px] text-muted-foreground">
                          {row.customer_email || ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-[14px] font-semibold tabular-nums">
                        {fmt(Number(row.amount_cents || 0) / 100, (row.currency || "USD").toUpperCase())}
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">
                        {row.stripe_payment_intent_id || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-[20px] border border-border px-[9px] py-[2px] text-[11.5px] font-medium text-muted-foreground">
                          {row.status || "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
      </div>
    </DashboardLayout>
  );
}
