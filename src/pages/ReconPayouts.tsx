// ═══════════════════════════════════════════════════════════════

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Stripe Payout Reconciliation
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gross payments → Stripe fees → Net deposit → QBO bank deposit
          </p>
        </div>

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : payouts?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No Stripe payouts found
            </CardContent>
          </Card>
        ) : (
          payouts?.map((payout: Record<string, unknown>) => {
            const isOpen = openPayout === (payout.id as string);
            const payments = (payout.stripe_payout_payments as Record<string, unknown>[]) || [];
            const grossTotal = payments.reduce((s: number, p: Record<string, unknown>) => s + ((p.gross_amount as number) || 0), 0);
            const feeTotal = payments.reduce((s: number, p: Record<string, unknown>) => s + ((p.fee_amount as number) || 0), 0);

            return (
              <Card key={payout.id as string} className={`${!payout.reconciled ? "border-orange-200" : "border-green-200"}`}>
                <CardContent className="p-0">
                  <Collapsible open={isOpen} onOpenChange={(v) => setOpenPayout(v ? payout.id as string : null)}>
                    <CollapsibleTrigger className="w-full text-left p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {payout.reconciled ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-sm">
                              Payout {format(new Date(payout.arrival_date as string), "MMM d, yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {payout.stripe_payout_id as string}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-right hidden md:block">
                            <p className="text-xs text-muted-foreground">Gross</p>
                            <p className="font-mono font-medium">${grossTotal.toFixed(2)}</p>
                          </div>
                          <div className="text-right hidden md:block">
                            <p className="text-xs text-muted-foreground">Fees</p>
                            <p className="font-mono text-red-600">−${feeTotal.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Net</p>
                            <p className="font-mono font-bold">${(payout.net_amount as number).toFixed(2)}</p>
                          </div>
                          <Badge className={payout.reconciled ? "bg-green-100 text-green-800 border-green-200" : "bg-orange-100 text-orange-800 border-orange-200"}>
                            {payout.reconciled ? "Reconciled" : "Unreconciled"}
                          </Badge>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t px-4 pb-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">
                          Component Payments ({payments.length})
                        </p>
                        {payments.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
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
                                    <TableCell className="font-mono text-xs text-red-600">
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
                                <TableCell className="font-mono text-xs text-red-600">−${feeTotal.toFixed(2)}</TableCell>
                                <TableCell className="font-mono text-xs">${(payout.net_amount as number).toFixed(2)}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        )}

                        {payout.qbo_deposit_id && (
                          <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Matched to QBO Deposit: {payout.qbo_deposit_id as string}
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}

export default ReconPayouts;


// ═══════════════════════════════════════════════════════════════
