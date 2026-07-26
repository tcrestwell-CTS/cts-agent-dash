import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { SemanticStatusPill } from "@/components/patterns/StatusPill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATUS_SEMANTIC: Record<string, "muted" | "info" | "warning" | "success" | "destructive"> = {
  paid: "success",
  in_transit: "info",
  pending: "warning",
  failed: "destructive",
  canceled: "muted",
};

export default function BookkeeperBankRecon() {
  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-bank-recon"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stripe_payouts")
        .select("id, stripe_payout_id, amount, fee_total, net_amount, arrival_date, status, reconciled")
        .order("arrival_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="space-y-1">
          <BookkeeperBreadcrumb page="Bank Reconciliation" />
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Bank Reconciliation</h1>
          <p className="text-[13.5px] text-muted-foreground">Stripe payouts arriving in the operating bank account.</p>
        </div>
        <Panel>
          <PanelHeader title="Recent payouts" />
          <PanelBody>
            {isLoading ? <Skeleton className="h-64 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Arrival</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Payout ID</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Status</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Gross</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Fees</TableHead>
                    <TableHead className="bg-card-2 text-right text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Net</TableHead>
                    <TableHead className="bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground">Reconciled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-[13.5px]">{r.arrival_date ? format(new Date(r.arrival_date + "T00:00:00"), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="font-mono text-[12.5px] text-muted-foreground">{r.stripe_payout_id}</TableCell>
                      <TableCell>
                        <SemanticStatusPill status={STATUS_SEMANTIC[r.status] ?? "muted"} label={r.status || "—"} />
                      </TableCell>
                      <TableCell className="text-right text-[14px] tabular-nums">{fmt(Number(r.amount || 0))}</TableCell>
                      <TableCell className="text-right text-[14px] tabular-nums text-muted-foreground">{fmt(Number(r.fee_total || 0))}</TableCell>
                      <TableCell className="text-right text-[14px] font-semibold tabular-nums">{fmt(Number(r.net_amount || 0))}</TableCell>
                      <TableCell>
                        {r.reconciled ? (
                          <SemanticStatusPill status="success" label="Matched" />
                        ) : (
                          <SemanticStatusPill status="muted" label="Pending" />
                        )}
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
