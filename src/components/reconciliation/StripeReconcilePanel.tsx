import { useState, useCallback, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCcw, AlertTriangle, CheckCircle2, Link2, Plus, DollarSign, XCircle, CreditCard, Search,
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
  qbo_payment_matching?: {
    window_days: number;
    stripe_succeeded_count: number;
    qbo_entry_count: number;
    matched_count: number;
    unmatched_in_qbo_count: number;
    unmatched_in_stripe_count: number;
    matched: any[];
    unmatched_in_qbo: any[];
    unmatched_in_stripe: any[];
    error?: boolean;
    message?: string;
  };
}

type ActionType = "link" | "create" | "adjust" | "dismiss";

interface ActionDialog {
  type: ActionType;
  item: any;
  source: "orphan" | "checkout_mismatch" | "trip_mismatch";
}

interface TripOption {
  id: string;
  trip_name: string;
  client_name: string | null;
  destination: string | null;
}

interface UnlinkedPayment {
  id: string;
  trip_id: string;
  amount: number;
  status: string;
  payment_date: string;
  payment_type: string;
  trip_name?: string;
  client_name?: string;
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

  // Trip search for both link and create
  const [tripSearch, setTripSearch] = useState("");
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState("");

  // For link dialog — payments for selected trip
  const [tripPayments, setTripPayments] = useState<UnlinkedPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");

  // For link dialog — all unlinked payments tab
  const [allUnlinked, setAllUnlinked] = useState<UnlinkedPayment[]>([]);
  const [allUnlinkedLoading, setAllUnlinkedLoading] = useState(false);
  const [unlinkedSearch, setUnlinkedSearch] = useState("");

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

  // Search trips when dialog opens or search changes
  const searchTrips = useCallback(async (query: string) => {
    if (!user) return;
    setTripsLoading(true);
    try {
      let q = supabase
        .from("trips")
        .select("id, trip_name, destination, clients(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (query.trim()) {
        q = q.or(`trip_name.ilike.%${query}%,destination.ilike.%${query}%`);
      }
      const { data: results } = await q;
      setTrips(
        (results || []).map((t: any) => ({
          id: t.id,
          trip_name: t.trip_name,
          client_name: t.clients?.name || null,
          destination: t.destination,
        }))
      );
    } catch {
      setTrips([]);
    } finally {
      setTripsLoading(false);
    }
  }, [user]);

  // Fetch payments for a specific trip (unlinked to Stripe)
  const fetchTripPayments = useCallback(async (tripId: string) => {
    setPaymentsLoading(true);
    try {
      const { data: payments } = await supabase
        .from("trip_payments")
        .select("id, trip_id, amount, status, payment_date, payment_type, stripe_session_id")
        .eq("trip_id", tripId)
        .is("stripe_session_id", null)
        .order("payment_date", { ascending: false });
      setTripPayments(
        (payments || []).map((p) => ({
          id: p.id,
          trip_id: p.trip_id,
          amount: p.amount,
          status: p.status,
          payment_date: p.payment_date,
          payment_type: p.payment_type,
        }))
      );
    } catch {
      setTripPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  // Fetch all unlinked payments across all trips
  const fetchAllUnlinked = useCallback(async () => {
    if (!user) return;
    setAllUnlinkedLoading(true);
    try {
      const { data: payments } = await supabase
        .from("trip_payments")
        .select("id, trip_id, amount, status, payment_date, payment_type, stripe_session_id, trips(trip_name, clients(name))")
        .eq("user_id", user.id)
        .is("stripe_session_id", null)
        .neq("status", "paid")
        .order("payment_date", { ascending: false })
        .limit(50);
      setAllUnlinked(
        (payments || []).map((p: any) => ({
          id: p.id,
          trip_id: p.trip_id,
          amount: p.amount,
          status: p.status,
          payment_date: p.payment_date,
          payment_type: p.payment_type,
          trip_name: p.trips?.trip_name || "",
          client_name: p.trips?.clients?.name || "",
        }))
      );
    } catch {
      setAllUnlinked([]);
    } finally {
      setAllUnlinkedLoading(false);
    }
  }, [user]);

  // When link dialog opens, load trips and all unlinked
  useEffect(() => {
    if (actionDialog?.type === "link") {
      searchTrips("");
      fetchAllUnlinked();
      setSelectedTripId("");
      setSelectedPaymentId("");
      setTripSearch("");
      setUnlinkedSearch("");
    }
    if (actionDialog?.type === "create") {
      searchTrips("");
      setSelectedTripId("");
      setTripSearch("");
    }
  }, [actionDialog?.type, searchTrips, fetchAllUnlinked]);

  // When trip selected in link dialog, fetch its payments
  useEffect(() => {
    if (selectedTripId && actionDialog?.type === "link") {
      fetchTripPayments(selectedTripId);
      setSelectedPaymentId("");
    }
  }, [selectedTripId, actionDialog?.type, fetchTripPayments]);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    toast.success("Item dismissed");
    setActionDialog(null);
  };

  const handleLinkOrphan = async () => {
    if (!actionDialog || !selectedPaymentId) return;
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
        .eq("id", selectedPaymentId);
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
    if (!actionDialog || !selectedTripId || !user) return;
    setActionLoading(true);
    try {
      const item = actionDialog.item;
      const { error } = await supabase.from("trip_payments").insert({
        trip_id: selectedTripId,
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

  const filteredAllUnlinked = unlinkedSearch
    ? allUnlinked.filter(
        (p) =>
          p.trip_name?.toLowerCase().includes(unlinkedSearch.toLowerCase()) ||
          p.client_name?.toLowerCase().includes(unlinkedSearch.toLowerCase()) ||
          p.amount.toString().includes(unlinkedSearch)
      )
    : allUnlinked;

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
                            onClick={() => setActionDialog({ type: "link", item, source: "orphan" })}
                          >
                            <Link2 className="h-3 w-3" /> Link
                          </Button>
                          <Button
                            size="sm" variant="outline" className="gap-1 h-7 text-xs"
                            onClick={() => setActionDialog({ type: "create", item, source: "orphan" })}
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

            {/* Stripe ↔ QBO per-payment matching */}
            {data.qbo_payment_matching && !data.qbo_payment_matching.error && (
              <div className="space-y-2 border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Stripe payments ↔ QuickBooks deposits
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      {data.qbo_payment_matching.matched_count} matched
                    </Badge>
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                      {data.qbo_payment_matching.unmatched_in_qbo_count} not in QBO
                    </Badge>
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      {data.qbo_payment_matching.unmatched_in_stripe_count} QBO-only
                    </Badge>
                  </div>
                </div>

                <Tabs defaultValue="matched" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="matched">Matched</TabsTrigger>
                    <TabsTrigger value="missing-qbo">Missing in QBO</TabsTrigger>
                    <TabsTrigger value="qbo-only">QBO-only</TabsTrigger>
                  </TabsList>

                  <TabsContent value="matched" className="mt-2">
                    {data.qbo_payment_matching.matched.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">No matches yet</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Stripe PI</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>QBO Type</TableHead>
                            <TableHead>QBO Ref</TableHead>
                            <TableHead>Confidence</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.qbo_payment_matching.matched.slice(0, 50).map((m: any) => (
                            <TableRow key={m.pi_id}>
                              <TableCell className="font-mono text-xs">{m.pi_id.slice(0, 18)}…</TableCell>
                              <TableCell>{fmt(m.amount)}</TableCell>
                              <TableCell className="text-xs">{format(new Date(m.created), "MMM d")}</TableCell>
                              <TableCell>{m.qbo_type}</TableCell>
                              <TableCell className="text-xs">{m.qbo_ref || "—"}</TableCell>
                              <TableCell>
                                <Badge variant={m.confidence === "high" ? "default" : m.confidence === "medium" ? "secondary" : "outline"}>
                                  {m.confidence}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  <TabsContent value="missing-qbo" className="mt-2">
                    {data.qbo_payment_matching.unmatched_in_qbo.length === 0 ? (
                      <div className="text-sm text-success py-4 text-center flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Every Stripe payment has a QBO entry
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Stripe PI</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.qbo_payment_matching.unmatched_in_qbo.slice(0, 50).map((u: any) => (
                            <TableRow key={u.pi_id}>
                              <TableCell className="font-mono text-xs">{u.pi_id.slice(0, 18)}…</TableCell>
                              <TableCell>{fmt(u.amount)}</TableCell>
                              <TableCell className="text-xs">{format(new Date(u.created), "MMM d")}</TableCell>
                              <TableCell className="text-xs">{u.customer_email || "—"}</TableCell>
                              <TableCell className="text-xs">{u.description || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  <TabsContent value="qbo-only" className="mt-2">
                    {data.qbo_payment_matching.unmatched_in_stripe.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">All QBO entries reconciled</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>QBO Type</TableHead>
                            <TableHead>Ref</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Note</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.qbo_payment_matching.unmatched_in_stripe.slice(0, 50).map((q: any) => (
                            <TableRow key={`${q.qbo_type}:${q.qbo_id}`}>
                              <TableCell>{q.qbo_type}</TableCell>
                              <TableCell className="text-xs">{q.ref || "—"}</TableCell>
                              <TableCell>{fmt(q.amount)}</TableCell>
                              <TableCell className="text-xs">{q.date}</TableCell>
                              <TableCell className="text-xs max-w-xs truncate">{q.note || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {data.qbo_payment_matching?.error && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {data.qbo_payment_matching.message}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Link Orphan Dialog */}
      <Dialog open={actionDialog?.type === "link"} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Orphan to Trip Payment</DialogTitle>
            <DialogDescription>
              Stripe PI {fmt(actionDialog?.item?.amount || 0)}
              {actionDialog?.item?.customer_email && ` • ${actionDialog.item.customer_email}`}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="by-trip" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="by-trip">Search by Trip</TabsTrigger>
              <TabsTrigger value="all-unlinked">All Unlinked Payments</TabsTrigger>
            </TabsList>

            <TabsContent value="by-trip" className="space-y-3 mt-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search trips by name, client, or destination..."
                  className="pl-9"
                  value={tripSearch}
                  onChange={(e) => {
                    setTripSearch(e.target.value);
                    searchTrips(e.target.value);
                  }}
                />
              </div>

              <div className="max-h-40 overflow-y-auto border rounded-md">
                {tripsLoading ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">Searching...</div>
                ) : trips.length === 0 ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">No trips found</div>
                ) : (
                  trips.map((trip) => (
                    <button
                      key={trip.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-b-0 transition-colors ${selectedTripId === trip.id ? "bg-primary/10 font-medium" : ""}`}
                      onClick={() => setSelectedTripId(trip.id)}
                    >
                      <span className="font-medium">{trip.trip_name || "Untitled"}</span>
                      {trip.client_name && (
                        <span className="text-muted-foreground ml-2">• {trip.client_name}</span>
                      )}
                      {trip.destination && (
                        <span className="text-muted-foreground ml-1 text-xs">({trip.destination})</span>
                      )}
                    </button>
                  ))
                )}
              </div>

              {selectedTripId && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Unlinked payments on this trip:</p>
                  <div className="max-h-32 overflow-y-auto border rounded-md">
                    {paymentsLoading ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">Loading...</div>
                    ) : tripPayments.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">No unlinked payments on this trip</div>
                    ) : (
                      tripPayments.map((p) => (
                        <button
                          key={p.id}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-b-0 flex items-center justify-between transition-colors ${selectedPaymentId === p.id ? "bg-primary/10 font-medium" : ""}`}
                          onClick={() => setSelectedPaymentId(p.id)}
                        >
                          <span>
                            {fmt(p.amount)} • {p.payment_type}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-xs">{p.status}</Badge>
                            <span className="ml-1">{p.payment_date}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="all-unlinked" className="space-y-3 mt-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by trip name, client, or amount..."
                  className="pl-9"
                  value={unlinkedSearch}
                  onChange={(e) => setUnlinkedSearch(e.target.value)}
                />
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-md">
                {allUnlinkedLoading ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">Loading...</div>
                ) : filteredAllUnlinked.length === 0 ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">No unlinked payments found</div>
                ) : (
                  filteredAllUnlinked.map((p) => (
                    <button
                      key={p.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-b-0 flex items-center justify-between transition-colors ${selectedPaymentId === p.id ? "bg-primary/10 font-medium" : ""}`}
                      onClick={() => setSelectedPaymentId(p.id)}
                    >
                      <div>
                        <span className="font-medium">{fmt(p.amount)}</span>
                        <span className="text-muted-foreground ml-2">• {p.trip_name || "Unknown trip"}</span>
                        {p.client_name && (
                          <span className="text-muted-foreground text-xs ml-1">({p.client_name})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">{p.status}</Badge>
                        <span className="text-xs text-muted-foreground">{p.payment_date}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleLinkOrphan} disabled={!selectedPaymentId || actionLoading}>
              {actionLoading ? "Linking..." : "Link Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create from Orphan Dialog */}
      <Dialog open={actionDialog?.type === "create"} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Trip Payment from Orphan</DialogTitle>
            <DialogDescription>
              Create a new trip payment for {fmt(actionDialog?.item?.amount || 0)} from Stripe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trips by name, client, or destination..."
                className="pl-9"
                value={tripSearch}
                onChange={(e) => {
                  setTripSearch(e.target.value);
                  searchTrips(e.target.value);
                }}
              />
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-md">
              {tripsLoading ? (
                <div className="p-3 text-center text-sm text-muted-foreground">Searching...</div>
              ) : trips.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">No trips found</div>
              ) : (
                trips.map((trip) => (
                  <button
                    key={trip.id}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-b-0 transition-colors ${selectedTripId === trip.id ? "bg-primary/10 font-medium" : ""}`}
                    onClick={() => setSelectedTripId(trip.id)}
                  >
                    <span className="font-medium">{trip.trip_name || "Untitled"}</span>
                    {trip.client_name && (
                      <span className="text-muted-foreground ml-2">• {trip.client_name}</span>
                    )}
                    {trip.destination && (
                      <span className="text-muted-foreground ml-1 text-xs">({trip.destination})</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleCreateFromOrphan} disabled={!selectedTripId || actionLoading}>
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
