// ═══════════════════════════════════════════════════════════════

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelBody } from "@/components/patterns/Panel";
import { SemanticStatusPill } from "@/components/patterns/StatusPill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreditCard, CheckCircle2, ChevronDown, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useStripePayouts } from "@/hooks/useRecon";

export function ReconPayouts() {
  const { data: payouts, isLoading } = useStripePayouts();
  const [openPayout, setOpenPayout] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.025em] text-foreground">
            <CreditCard className="h-4 w-4 text-primary" />
            Stripe Payout Reconciliation
          </h1>
          <p className="text-[13.5px] text-muted-foreground">
            Gross payments → Stripe fees → Net deposit → QBO bank deposit
          </p>
        </div>

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Panel key={i}><PanelBody><Skeleton className="h-20 w-full" /></PanelBody></Panel>
          ))
        ) : payouts?.length === 0 ? (
          <Panel>
            <PanelBody className="py-12 text-center text-muted-foreground text-[13.5px]">
              No Stripe payouts found
            </PanelBody>
          </Panel>
        ) : (
          payouts?.map((payout: Record<string, unknown>) => {
            const isOpen = openPayout === (payout.id as string);
            const payments = (payout.stripe_payout_payments as Record<string, unknown>[]) || [];
            const grossTotal = payments.reduce((s: number, p: Record<string, unknown>) => s + ((p.gross_amount as number) || 0), 0);
            const feeTotal = payments.reduce((s: number, p: Record<string, unknown>) => s + ((p.fee_amount as number) || 0), 0);

            return (
              <Panel key={payout.id as string} className={!payout.reconciled ? "border-warning/40" : "border-success/40"}>
                <PanelBody className="p-0">
                  <Collapsible open={isOpen} onOpenChange={(v) => setOpenPayout(v ? payout.id as string : null)}>
                    <CollapsibleTrigger className="w-full text-left p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {payout.reconciled ? (
                            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
                          )}
                          <div>
                            <p className="text-[13.5px] font-medium text-foreground">
                              Payout {format(new Date(payout.arrival_date as string), "MMM d, yyyy")}
                            </p>
                            <p className="font-mono text-[11.5px] text-muted-foreground">
                              {payout.stripe_payout_id as string}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-right hidden md:block">
                            <p className="text-[11.5px] text-muted-foreground">Gross</p>
                            <p className="font-mono font-medium tabular-nums">${grossTotal.toFixed(2)}</p>
                          </div>
                          <div className="text-right hidden md:block">
                            <p className="text-[11.5px] text-muted-foreground">Fees</p>
                            <p className="font-mono tabular-nums text-destructive">−${feeTotal.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11.5px] text-muted-foreground">Net</p>
                            <p className="font-mono font-semibold tabular-nums text-foreground">${(payout.net_amount as number).toFixed(2)}</p>
                          </div>
                          <SemanticStatusPill
                            status={payout.reconciled ? "success" : "warning"}
                            label={payout.reconciled ? "Reconciled" : "Unreconciled"}
                          />
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t px-4 pb-4">
                        <p className="py-3 text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
                          Component Payments ({payments.length})
                        </p>
                        {payments.length === 0 ? (
                          <p className="py-2 text-[13.5px] text-muted-foreground">
                            No component payments linked yet — run reconciliation to populate
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Invoice</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Gross</TableHead>
                                <TableHead>Fee</TableHead>
                                <TableHead>Net</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {payments.map((p: Record<string, unknown>, idx: number) => {
                                const sp = p.stripe_payments as Record<string, unknown> | null;
                                return (
                                  <TableRow key={idx}>
                                    <TableCell className="text-xs font-mono">
                                      {sp?.invoice_number as string || "—"}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {sp?.customer_name as string || sp?.customer_email as string || "—"}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                      ${(p.gross_amount as number).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-destructive">
                                      −${(p.fee_amount as number).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs font-medium">
                                      ${(p.net_contribution as number).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              <TableRow className="bg-muted/50 font-bold">
                                <TableCell colSpan={2} className="text-xs">Total</TableCell>
                                <TableCell className="font-mono text-xs">${grossTotal.toFixed(2)}</TableCell>
                                <TableCell className="font-mono text-xs text-destructive">−${feeTotal.toFixed(2)}</TableCell>
                                <TableCell className="font-mono text-xs">${(payout.net_amount as number).toFixed(2)}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        )}

                        {payout.qbo_deposit_id && (
                          <p className="mt-3 flex items-center gap-1 text-[12px] text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            Matched to QBO Deposit: {payout.qbo_deposit_id as string}
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </PanelBody>
              </Panel>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}

export default ReconPayouts;


// ═══════════════════════════════════════════════════════════════
