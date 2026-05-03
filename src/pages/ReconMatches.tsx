// src/pages/ReconMatches.tsx
// Lists all reconciliation matches with filtering, search, and detail drawer

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, ArrowRightLeft, CheckCircle2, AlertTriangle,
  Clock, XCircle, ChevronRight, Info,
} from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useReconMatches, ReconMatch, ReconMatchStatus } from "@/hooks/useRecon";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STATUS_CONFIG: Record<ReconMatchStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  new:           { label: "Needs Review",   color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  reviewing:     { label: "Reviewing",      color: "bg-blue-100 text-blue-800 border-blue-200",       icon: Clock },
  approved:      { label: "Approved",       color: "bg-green-100 text-green-800 border-green-200",    icon: CheckCircle2 },
  posted_to_qbo: { label: "Posted to QBO",  color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  rejected:      { label: "Rejected",       color: "bg-red-100 text-red-800 border-red-200",          icon: XCircle },
  exception:     { label: "Exception",      color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
};

const MATCH_TYPE_LABELS: Record<string, string> = {
  crm_booking_to_qbo_invoice:    "Booking → Invoice",
  crm_payment_to_qbo_payment:    "Payment → QBO Payment",
  stripe_payment_to_qbo_payment: "Stripe → QBO Payment",
  stripe_payout_to_qbo_deposit:  "Payout → Deposit",
  crm_supplier_to_qbo_bill:      "Supplier → Bill",
  crm_supplier_to_qbo_billpayment: "Supplier → Bill Payment",
  missing_qbo_record:            "Missing QBO Record",
  missing_crm_record:            "Missing CRM Record",
};

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 95 ? "bg-green-100 text-green-800 border-green-200" :
    score >= 70 ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
    "bg-red-100 text-red-800 border-red-200";
  return (
    <Badge className={`${color} font-mono text-xs`}>{score}%</Badge>
  );
}

function MatchDrawer({
  match,
  open,
  onClose,
}: {
  match: ReconMatch | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!match) return null;
  const cfg = STATUS_CONFIG[match.status];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Match Detail
          </SheetTitle>
          <SheetDescription>
            {MATCH_TYPE_LABELS[match.match_type] || match.match_type}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Status & Score */}
          <div className="flex items-center gap-3">
            <Badge className={cfg.color}>{cfg.label}</Badge>
            <ConfidenceBadge score={match.confidence_score} />
            {match.auto_matched && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                Auto-matched
              </Badge>
            )}
          </div>

          {/* Why Matched */}
          {match.match_explanation && (
            <div className="bg-muted rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Info className="h-3 w-3" /> Why This Matched
              </p>
              <p className="text-sm">{match.match_explanation}</p>
            </div>
          )}

          {/* Score Breakdown */}
          {match.score_breakdown && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Score Breakdown
              </p>
              <div className="space-y-1">
                {Object.entries(match.score_breakdown).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{k}</span>
                    <span className="font-mono font-medium">{v} pts</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
                  <span>Total</span>
                  <span className="font-mono">{match.confidence_score} / 100</span>
                </div>
              </div>
            </div>
          )}

          {/* Amount Comparison */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Amount Comparison
            </p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {match.crm_amount !== null && (
                <div className="bg-muted rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">CRM</p>
                  <p className="font-mono font-medium">${match.crm_amount.toFixed(2)}</p>
                </div>
              )}
              {match.stripe_amount !== null && (
                <div className="bg-muted rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">Stripe</p>
                  <p className="font-mono font-medium">${match.stripe_amount.toFixed(2)}</p>
                </div>
              )}
              {match.qbo_amount !== null && (
                <div className="bg-muted rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">QBO</p>
                  <p className="font-mono font-medium">${match.qbo_amount.toFixed(2)}</p>
                </div>
              )}
            </div>
            {(match.amount_variance ?? 0) > 0 && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠ Variance: ${match.amount_variance?.toFixed(2)}
              </p>
            )}
          </div>

          {/* Date Comparison */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Date Comparison
            </p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {match.crm_date && (
                <div className="bg-muted rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">CRM</p>
                  <p className="font-mono text-xs">{match.crm_date}</p>
                </div>
              )}
              {match.stripe_date && (
                <div className="bg-muted rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">Stripe</p>
                  <p className="font-mono text-xs">{match.stripe_date}</p>
                </div>
              )}
              {match.qbo_date && (
                <div className="bg-muted rounded p-2 text-center">
                  <p className="text-xs text-muted-foreground">QBO</p>
                  <p className="font-mono text-xs">{match.qbo_date}</p>
                </div>
              )}
            </div>
          </div>

          {/* Recommended Action */}
          {match.recommended_action && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Recommended Action</p>
              <p className="text-sm text-blue-900">{match.recommended_action}</p>
            </div>
          )}

          {/* Record IDs */}
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
            <p className="font-semibold mb-1">Record IDs</p>
            {match.crm_booking_id && <p>CRM Booking: {match.crm_booking_id}</p>}
            {match.qbo_invoice_id && <p>QBO Invoice: {match.qbo_invoice_id}</p>}
            {match.qbo_payment_id && <p>QBO Payment: {match.qbo_payment_id}</p>}
            {match.stripe_payment_id && <p>Stripe Payment: {match.stripe_payment_id}</p>}
            {match.stripe_payout_id && <p>Stripe Payout: {match.stripe_payout_id}</p>}
            <p>Created: {format(new Date(match.created_at), "MMM d, yyyy h:mm a")}</p>
          </div>

          {/* Linked Item Details */}
          <MatchItemDetails match={match} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailBlock({ title, rows }: { title: string; rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="border rounded-lg p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1 text-sm">
        {rows.map(([k, v]) =>
          v == null || v === "" ? null : (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-right break-all">{v}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function MatchItemDetails({ match }: { match: ReconMatch }) {
  const { data, isLoading } = useQuery({
    queryKey: ["recon-match-items", match.id],
    queryFn: async () => {
      const out: {
        booking?: any;
        supplier?: any;
        trip?: any;
        qboInvoice?: any;
        qboBill?: any;
        qboPayment?: any;
        qboDeposit?: any;
        qboCustomer?: any;
        qboVendor?: any;
        stripePayment?: any;
        stripePayout?: any;
      } = {};

      if (match.crm_booking_id) {
        const { data: b } = await supabase
          .from("bookings")
          .select("id, confirmation_number, total_price, gross_sales, supplier_id, trip_id, status")
          .eq("id", match.crm_booking_id)
          .maybeSingle();
        out.booking = b;
        if (b?.supplier_id) {
          const { data: s } = await supabase
            .from("suppliers")
            .select("id, name")
            .eq("id", b.supplier_id)
            .maybeSingle();
          out.supplier = s;
        }
        if (b?.trip_id) {
          const { data: t } = await supabase
            .from("trips")
            .select("id, trip_name")
            .eq("id", b.trip_id)
            .maybeSingle();
          out.trip = t;
        }
      }

      if (match.qbo_invoice_id) {
        const { data: inv } = await supabase
          .from("qbo_invoices")
          .select("id, qbo_id, doc_number, total_amt, balance, txn_date, status, qbo_customer_id")
          .eq("id", match.qbo_invoice_id)
          .maybeSingle();
        out.qboInvoice = inv;
        if (inv?.qbo_customer_id) {
          const { data: c } = await supabase
            .from("qbo_customers")
            .select("qbo_id, display_name")
            .eq("qbo_id", inv.qbo_customer_id)
            .maybeSingle();
          out.qboCustomer = c;
        }
      }

      if (match.qbo_bill_id) {
        const { data: bill } = await supabase
          .from("qbo_bills")
          .select("id, qbo_id, doc_number, total_amt, balance, txn_date, status, qbo_vendor_id")
          .eq("id", match.qbo_bill_id)
          .maybeSingle();
        out.qboBill = bill;
        if (bill?.qbo_vendor_id) {
          const { data: v } = await supabase
            .from("qbo_vendors")
            .select("qbo_id, display_name")
            .eq("qbo_id", bill.qbo_vendor_id)
            .maybeSingle();
          out.qboVendor = v;
        }
      }

      if (match.qbo_payment_id) {
        const { data: p } = await supabase
          .from("qbo_payments")
          .select("id, qbo_id, total_amt, txn_date, payment_ref_num, qbo_customer_id")
          .eq("id", match.qbo_payment_id)
          .maybeSingle();
        out.qboPayment = p;
      }

      if (match.qbo_deposit_id) {
        const { data: d } = await supabase
          .from("qbo_deposits")
          .select("id, qbo_id, total_amt, txn_date, memo")
          .eq("id", match.qbo_deposit_id)
          .maybeSingle();
        out.qboDeposit = d;
      }

      if (match.stripe_payment_id) {
        const { data: sp } = await supabase
          .from("stripe_payments")
          .select("id, stripe_payment_intent_id, gross_amount, net_amount, customer_name, customer_email, stripe_created_at, invoice_number, status")
          .eq("id", match.stripe_payment_id)
          .maybeSingle();
        out.stripePayment = sp;
      }

      if (match.stripe_payout_id) {
        const { data: po } = await supabase
          .from("stripe_payouts")
          .select("id, stripe_payout_id, amount, net_amount, fee_total, arrival_date, status")
          .eq("id", match.stripe_payout_id)
          .maybeSingle();
        out.stripePayout = po;
      }

      return out;
    },
    enabled: !!match.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide">Linked Items</p>

      {data.booking && (
        <DetailBlock
          title="CRM Booking"
          rows={[
            ["Confirmation #", data.booking.confirmation_number],
            ["Trip", data.trip?.trip_name],
            ["Supplier", data.supplier?.name],
            ["Status", data.booking.status],
            ["Gross Sales", data.booking.gross_sales != null ? `$${Number(data.booking.gross_sales).toFixed(2)}` : null],
            ["Total Price", data.booking.total_price != null ? `$${Number(data.booking.total_price).toFixed(2)}` : null],
          ]}
        />
      )}

      {data.qboInvoice && (
        <DetailBlock
          title="QBO Invoice"
          rows={[
            ["Doc #", data.qboInvoice.doc_number],
            ["QBO ID", data.qboInvoice.qbo_id],
            ["Customer", data.qboCustomer?.display_name],
            ["Date", data.qboInvoice.txn_date],
            ["Total", data.qboInvoice.total_amt != null ? `$${Number(data.qboInvoice.total_amt).toFixed(2)}` : null],
            ["Balance", data.qboInvoice.balance != null ? `$${Number(data.qboInvoice.balance).toFixed(2)}` : null],
            ["Status", data.qboInvoice.status],
          ]}
        />
      )}

      {data.qboBill && (
        <DetailBlock
          title="QBO Bill"
          rows={[
            ["Doc #", data.qboBill.doc_number],
            ["QBO ID", data.qboBill.qbo_id],
            ["Vendor", data.qboVendor?.display_name],
            ["Date", data.qboBill.txn_date],
            ["Total", data.qboBill.total_amt != null ? `$${Number(data.qboBill.total_amt).toFixed(2)}` : null],
            ["Balance", data.qboBill.balance != null ? `$${Number(data.qboBill.balance).toFixed(2)}` : null],
            ["Status", data.qboBill.status],
          ]}
        />
      )}

      {data.qboPayment && (
        <DetailBlock
          title="QBO Payment"
          rows={[
            ["QBO ID", data.qboPayment.qbo_id],
            ["Ref #", data.qboPayment.payment_ref_num],
            ["Date", data.qboPayment.txn_date],
            ["Total", data.qboPayment.total_amt != null ? `$${Number(data.qboPayment.total_amt).toFixed(2)}` : null],
          ]}
        />
      )}

      {data.qboDeposit && (
        <DetailBlock
          title="QBO Deposit"
          rows={[
            ["QBO ID", data.qboDeposit.qbo_id],
            ["Memo", data.qboDeposit.memo],
            ["Date", data.qboDeposit.txn_date],
            ["Total", data.qboDeposit.total_amt != null ? `$${Number(data.qboDeposit.total_amt).toFixed(2)}` : null],
          ]}
        />
      )}

      {data.stripePayment && (
        <DetailBlock
          title="Stripe Payment"
          rows={[
            ["Intent", data.stripePayment.stripe_payment_intent_id],
            ["Invoice #", data.stripePayment.invoice_number],
            ["Customer", data.stripePayment.customer_name || data.stripePayment.customer_email],
            ["Date", data.stripePayment.stripe_created_at ? format(new Date(data.stripePayment.stripe_created_at), "MMM d, yyyy") : null],
            ["Gross", data.stripePayment.gross_amount != null ? `$${Number(data.stripePayment.gross_amount).toFixed(2)}` : null],
            ["Net", data.stripePayment.net_amount != null ? `$${Number(data.stripePayment.net_amount).toFixed(2)}` : null],
            ["Status", data.stripePayment.status],
          ]}
        />
      )}

      {data.stripePayout && (
        <DetailBlock
          title="Stripe Payout"
          rows={[
            ["Payout ID", data.stripePayout.stripe_payout_id],
            ["Arrival", data.stripePayout.arrival_date],
            ["Amount", data.stripePayout.amount != null ? `$${Number(data.stripePayout.amount).toFixed(2)}` : null],
            ["Net", data.stripePayout.net_amount != null ? `$${Number(data.stripePayout.net_amount).toFixed(2)}` : null],
            ["Fees", data.stripePayout.fee_total != null ? `$${Number(data.stripePayout.fee_total).toFixed(2)}` : null],
            ["Status", data.stripePayout.status],
          ]}
        />
      )}
    </div>
  );
}

export default function ReconMatches() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all"
  );
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReconMatch | null>(null);

  const { data: matches, isLoading } = useReconMatches(
    statusFilter !== "all" ? (statusFilter as ReconMatchStatus) : undefined,
    typeFilter !== "all" ? typeFilter : undefined
  );

  const filtered = useMemo(() => {
    if (!matches) return [];
    if (!search) return matches;
    const q = search.toLowerCase();
    return matches.filter(
      (m) =>
        m.match_type.includes(q) ||
        m.match_explanation?.toLowerCase().includes(q) ||
        m.crm_booking_id?.includes(q)
    );
  }, [matches, search]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Match Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Confidence-scored matches between CRM, Stripe, and QuickBooks
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search matches..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">Needs Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="posted_to_qbo">Posted to QBO</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="exception">Exception</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Match Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="crm_booking_to_qbo_invoice">Booking → Invoice</SelectItem>
              <SelectItem value="stripe_payment_to_qbo_payment">Stripe → QBO Payment</SelectItem>
              <SelectItem value="stripe_payout_to_qbo_deposit">Payout → Deposit</SelectItem>
              <SelectItem value="crm_supplier_to_qbo_bill">Supplier → Bill</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>CRM Amount</TableHead>
                  <TableHead>QBO Amount</TableHead>
                  <TableHead>Stripe Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      No matches found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m) => {
                    const cfg = STATUS_CONFIG[m.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <TableRow
                        key={m.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelected(m)}
                      >
                        <TableCell className="text-sm font-medium">
                          {MATCH_TYPE_LABELS[m.match_type] || m.match_type}
                        </TableCell>
                        <TableCell>
                          <ConfidenceBadge score={m.confidence_score} />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {m.crm_amount != null ? `$${m.crm_amount.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {m.qbo_amount != null ? `$${m.qbo_amount.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {m.stripe_amount != null ? `$${m.stripe_amount.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${cfg.color} flex items-center gap-1 w-fit`}>
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(m.created_at), "MMM d")}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <MatchDrawer
          match={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      </div>
    </DashboardLayout>
  );
}
