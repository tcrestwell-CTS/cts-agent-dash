import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  RefreshCcw, AlertTriangle, CheckCircle2, Link2, Plus, DollarSign, XCircle, CreditCard,
} from "lucide-react";
import { format } from "date-fns";

interface ReconcileResult {
  ok: boolean;
  checked_at: string;
  summary: {
    total_stripe_pis: number;
    total_local_checkout: number;
    total_local_trip: number;
    matched: number;
    discrepancies: number;
    orphaned_in_stripe: number;
    all_clear: boolean;
  };
  stripe_balance: { available: number; pending: number };
  volume_comparison: { stripe_succeeded_total: number; local_completed_total: number; variance: number };
  checkout_discrepancies: any[];
  trip_discrepancies: any[];
  orphaned_stripe_payments: any[];
  qbo_clearing: any;
}

type ActionType = "link" | "create" | "adjust" | "dismiss";

interface ActionDialog {
  type: ActionType;
  item: any;
  source: "orphan" | "checkout_mismatch" | "trip_mismatch";
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

export default function StripeReconcilePanel() {
  const { user } = useAuth();
  const [data, setData] = useState<ReconcileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // For link dialog
  const [linkTripId, setLinkTripId] = useState("");
  const [linkPaymentId, setLinkPaymentId] = useState("");

  // For create dialog
  const [createTripId, setCreateTripId] = useState("");

  // For adjust dialog
  const [adjustTarget, setAdjustTarget] = useState<"local" | "stripe">("local");

  const runReconcile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("stripe-reconcile");
      if (error) throw error;
      setData(result as ReconcileResult);
    } catch (err: any) {
      toast.error("Reconciliation failed: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    toast.success("Item dismissed");
    setActionDialog(null);
  };

  const handleLinkOrphan = async () => {
    if (!actionDialog || !linkPaymentId) return;
    setActionLoading(true);
    try {
      const piId = actionDialog.item.pi_id;
      const { error } = await supabase
        .from("trip_payments")
        .update({
          stripe_session_id: piId,
          status: "paid",
          payment_method: "stripe",
          notes: `Linked from orphan Stripe PI ${piId} during reconciliation`,
        })
        .eq("id", linkPaymentId);
      if (error) throw error;
      toast.success("Orphan payment linked to trip payment");
      handleDismiss(piId);
      await runReconcile();
    } catch (err: any) {
      toast.error("Failed to link: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateFromOrphan = async () => {
    if (!actionDialog || !createTripId || !user) return;
    setActionLoading(true);
    try {
      const item = actionDialog.item;
      const { error } = await supabase.from("trip_payments").insert({
        trip_id: createTripId,
        user_id: user.id,
        amount: item.amount,
        payment_date: item.created?.split("T")[0] || new Date().toISOString().split("T")[0],
        payment_type: "payment",
        payment_method: "stripe",
        status: "paid",
        stripe_session_id: item.pi_id,
        details: item.description || null,
        notes: `Auto-created from orphan Stripe PI ${item.pi_id}`,
      });
      if (error) throw error;
      toast.success("Trip payment created from orphan");
      handleDismiss(item.pi_id);
      await runReconcile();
    } catch (err: any) {
      toast.error("Failed to create: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustAmount = async () => {
    if (!actionDialog) return;
    setActionLoading(true);
    try {
      const item = actionDialog.item;
      if (adjustTarget === "local") {
        // Update local record to match Stripe
        const table = actionDialog.source === "checkout_mismatch" ? "checkout_payments" : "trip_payments";
        const updateData =
          table === "checkout_payments"
            ? { amount_cents: Math.round(item.stripe_amount * 100), status: mapStripeStatus(item.stripe_status) }
            : { amount: item.stripe_amount, status: mapStripeStatus(item.stripe_status) };

        const { error } = await supabase
          .from(table)
          .update(updateData)
          .eq("id", item.local_id);
        if (error) throw error;
        toast.success("Local record updated to match Stripe");
      }
      handleDismiss(item.local_id);
      await runReconcile();
    } catch (err: any) {
      toast.error("Failed to adjust: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const mapStripeStatus = (s: string) => {
    switch (s) {
      case "succeeded": return "paid";
      case "canceled": return "cancelled";
      default: return s;
    }
  };

  const issueKey = (item: any) => item.pi_id || item.local_id || JSON.stringify(item);

  const filteredCheckout = data?.checkout_discrepancies.filter((d) => !dismissed.has(issueKey(d))) || [];
  const filteredTrip = data?.trip_discrepancies.filter((d) => !dismissed.has(issueKey(d))) || [];
  const filteredOrphans = data?.orphaned_stripe_payments.filter((d) => !dismissed.has(issueKey(d))) || [];
  const totalIssues = filteredCheckout.length + filteredTrip.length + filteredOrphans.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Stripe Payment Reconciliation
            </CardTitle>
            <CardDescription>
              Detect mismatched and orphaned Stripe payments
              {data?.checked_at && (
                <span className="ml-2 text-xs">
                  Last checked: {format(new Date(data.checked_at), "MMM d, h:mm a")}
                </span>
              )}
            </CardDescription>
          </div>
          <Button onClick={runReconcile} disabled={loading} variant="outline" className="gap-2">
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Scanning..." : "Run Reconciliation"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading && !data && (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-32" />
          </div>
        )}

        {!data && !loading && (
          <div className="py-8 text-center text-muted-foreground">
            Click "Run Reconciliation" to scan for payment discrepancies
          </div>
        )}

        {data && (
          <>
            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Stripe PIs</p>
                <p className="text-xl font-semibold">{data.summary.total_stripe_pis}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Matched</p>
                <p className="text-xl font-semibold text-success">{data.summary.matched}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Issues</p>
                <p className={`text-xl font-semibold ${totalIssues > 0 ? "text-destructive" : "text-success"}`}>
                  {totalIssues}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Stripe Available</p>
                <p className="text-xl font-semibold">{fmt(data.stripe_balance.available)}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Volume Variance</p>
                <p className={`text-xl font-semibold ${Math.abs(data.volume_comparison.variance) > 1 ? "text-warning" : "text-success"}`}>
                  {fmt(data.volume_comparison.variance)}
                </p>
              </div>
            </div>

            {totalIssues === 0 && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-success/10 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">All payments reconciled — no issues found</span>
              </div>
            )}

            {/* Orphaned Stripe Payments */}
            {filteredOrphans.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Orphaned Stripe Payments ({filteredOrphans.length})
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PI ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrphans.map((item: any) => (
                      <TableRow key={item.pi_id}>
                        <TableCell className="font-mono text-xs">{item.pi_id?.slice(0, 20)}…</TableCell>
                        <TableCell className="font-medium">{fmt(item.amount)}</TableCell>
                        <TableCell>{item.customer_email || "—"}</TableCell>
                        <TableCell>{item.created ? format(new Date(item.created), "MMM d") : "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.description || "—"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm" variant="outline" className="gap-1 h-7 text-xs"
                            onClick={() => { setActionDialog({ type: "link", item, source: "orphan" }); setLinkPaymentId(""); setLinkTripId(""); }}
                          >
                            <Link2 className="h-3 w-3" /> Link
                          </Button>
                          <Button
                            size="sm" variant="outline" className="gap-1 h-7 text-xs"
                            onClick={() => { setActionDialog({ type: "create", item, source: "orphan" }); setCreateTripId(""); }}
                          >
                            <Plus className="h-3 w-3" /> Create
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleDismiss(item.pi_id)}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Checkout Mismatches */}
            {filteredCheckout.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Checkout Payment Mismatches ({filteredCheckout.length})
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Local Amount</TableHead>
                      <TableHead>Stripe Amount</TableHead>
                      <TableHead>Variance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCheckout.map((item: any) => (
                      <TableRow key={issueKey(item)}>
                        <TableCell>{item.customer || "—"}</TableCell>
                        <TableCell>{fmt(item.local_amount || item.amount || 0)}</TableCell>
                        <TableCell>{item.stripe_amount ? fmt(item.stripe_amount) : "—"}</TableCell>
                        <TableCell className={item.amount_variance ? "text-destructive font-medium" : ""}>
                          {item.amount_variance ? fmt(item.amount_variance) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant="secondary" className="text-xs">{item.local_status || item.status}</Badge>
                            {item.stripe_status && (
                              <Badge variant="outline" className="text-xs">{item.stripe_status}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{item.message}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {item.type === "mismatch" && (
                            <Button
                              size="sm" variant="outline" className="gap-1 h-7 text-xs"
                              onClick={() => setActionDialog({ type: "adjust", item, source: "checkout_mismatch" })}
                            >
                              <DollarSign className="h-3 w-3" /> Adjust
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleDismiss(issueKey(item))}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Trip Payment Mismatches */}
            {filteredTrip.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Trip Payment Mismatches ({filteredTrip.length})
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trip ID</TableHead>
                      <TableHead>Local Amount</TableHead>
                      <TableHead>Stripe Amount</TableHead>
                      <TableHead>Variance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrip.map((item: any) => (
                      <TableRow key={issueKey(item)}>
                        <TableCell className="font-mono text-xs">{item.trip_id?.slice(0, 8)}…</TableCell>
                        <TableCell>{fmt(item.local_amount || item.amount || 0)}</TableCell>
                        <TableCell>{item.stripe_amount ? fmt(item.stripe_amount) : "—"}</TableCell>
                        <TableCell className={item.amount_variance ? "text-destructive font-medium" : ""}>
                          {item.amount_variance ? fmt(item.amount_variance) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant="secondary" className="text-xs">{item.local_status || item.status}</Badge>
                            {item.stripe_status && (
                              <Badge variant="outline" className="text-xs">{item.stripe_status}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{item.message}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {item.type === "mismatch" && (
                            <Button
                              size="sm" variant="outline" className="gap-1 h-7 text-xs"
                              onClick={() => setActionDialog({ type: "adjust", item, source: "trip_mismatch" })}
                            >
                              <DollarSign className="h-3 w-3" /> Adjust
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleDismiss(issueKey(item))}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* QBO Clearing */}
            {data.qbo_clearing && !data.qbo_clearing.error && data.qbo_clearing.account_exists !== false && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${data.qbo_clearing.is_balanced ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {data.qbo_clearing.is_balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {data.qbo_clearing.message}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Link Orphan Dialog */}
      <Dialog open={actionDialog?.type === "link"} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Orphan to Existing Trip Payment</DialogTitle>
            <DialogDescription>
              Link Stripe PI <span className="font-mono">{actionDialog?.item?.pi_id?.slice(0, 25)}…</span> ({fmt(actionDialog?.item?.amount || 0)}) to an existing trip payment record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Trip Payment ID</label>
              <Input
                placeholder="Paste the trip payment UUID"
                value={linkPaymentId}
                onChange={(e) => setLinkPaymentId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Find this in the trip's payment tab</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleLinkOrphan} disabled={!linkPaymentId || actionLoading}>
              {actionLoading ? "Linking..." : "Link Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create from Orphan Dialog */}
      <Dialog open={actionDialog?.type === "create"} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Trip Payment from Orphan</DialogTitle>
            <DialogDescription>
              Create a new trip payment record for {fmt(actionDialog?.item?.amount || 0)} from Stripe PI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Trip ID</label>
              <Input
                placeholder="Paste the trip UUID"
                value={createTripId}
                onChange={(e) => setCreateTripId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">The trip this payment belongs to</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleCreateFromOrphan} disabled={!createTripId || actionLoading}>
              {actionLoading ? "Creating..." : "Create Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Mismatch Dialog */}
      <Dialog open={actionDialog?.type === "adjust"} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Payment Mismatch</DialogTitle>
            <DialogDescription>{actionDialog?.item?.message}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">Local Record</p>
                <p className="font-semibold">{fmt(actionDialog?.item?.local_amount || 0)}</p>
                <Badge variant="secondary" className="text-xs mt-1">{actionDialog?.item?.local_status}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stripe</p>
                <p className="font-semibold">{fmt(actionDialog?.item?.stripe_amount || 0)}</p>
                <Badge variant="outline" className="text-xs mt-1">{actionDialog?.item?.stripe_status}</Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Resolution</label>
              <Select value={adjustTarget} onValueChange={(v) => setAdjustTarget(v as "local" | "stripe")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Update local record to match Stripe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleAdjustAmount} disabled={actionLoading} variant="destructive">
              {actionLoading ? "Adjusting..." : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
