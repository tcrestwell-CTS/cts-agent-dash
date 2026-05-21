import { useState, useEffect } from "react";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Plus, CreditCard, DollarSign, Trash2, Check, Receipt, FileText, Mail, Loader2, ExternalLink, Copy, RefreshCw, CloudOff, Cloud } from "lucide-react";
import { useTripPayments, TripPayment } from "@/hooks/useTripPayments";
import { TripBooking } from "@/hooks/useTrips";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { AddPaymentDialog } from "./AddPaymentDialog";
import { AffirmVirtualCardButton } from "./AffirmVirtualCardButton";
import { generateInvoicePDF, InvoiceData } from "@/lib/invoiceGenerator";
import { InvoicePreviewDialog } from "./InvoicePreviewDialog";
import { useBrandingSettings } from "@/hooks/useBrandingSettings";
import { useInvoices } from "@/hooks/useInvoices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { applyPaymentToInstallments } from "@/lib/applyPaymentToInstallments";
import { PaymentTimelineVisual } from "@/components/shared-trip/PaymentTimelineVisual";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TripPaymentsProps {
  tripId: string;
  clientId?: string;
  bookings: TripBooking[];
  tripTotal: number;
  tripName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  tripStatus?: string;
  onDataChange?: () => void;
  onStatusChange?: (newStatus: string) => Promise<boolean>;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  paid: "bg-green-100 text-green-700 border-green-200",
  authorized: "bg-blue-100 text-blue-700 border-blue-200",
  refunded: "bg-purple-100 text-purple-700 border-purple-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

export function TripPayments({ 
  tripId,
  clientId,
  bookings, 
  tripTotal,
  tripName,
  clientName,
  clientEmail,
  clientPhone,
  destination,
  departDate,
  returnDate,
  tripStatus,
  onDataChange,
  onStatusChange,
}: TripPaymentsProps) {
  const {
    payments,
    loading,
    updatePayment,
    updating,
    deletePayment,
    fetchPayments,
    totalPaid,
    totalAuthorized,
    totalRemaining,
  } = useTripPayments(tripId);
  const { settings: brandingSettings } = useBrandingSettings();
  const { createInvoice, getNextInvoiceNumber } = useInvoices();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [creatingPaymentLink, setCreatingPaymentLink] = useState<string | null>(null);
  const [repullingQBO, setRepullingQBO] = useState(false);
  const [qboSyncedIds, setQboSyncedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshPayments = async () => {
    setRefreshing(true);
    try {
      await fetchPayments();
      onDataChange?.();
      toast.success("Payments refreshed");
    } catch (e) {
      console.error(e);
      toast.error("Failed to refresh payments");
    } finally {
      setRefreshing(false);
    }
  };
  const [marginLinesByBooking, setMarginLinesByBooking] = useState<Record<string, Array<{ description: string; quantity: number; unit_sell: number; total_sell: number; is_pass_through: boolean; sort_order: number }>>>({});

  // Load booking margin lines so the invoice can show itemized sub-lines per booking.
  useEffect(() => {
    const bookingIds = bookings.map((b) => b.id).filter(Boolean);
    if (bookingIds.length === 0) {
      setMarginLinesByBooking({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("booking_margin_lines")
        .select("booking_id, description, quantity, unit_sell, total_sell, is_pass_through, sort_order, is_internal")
        .in("booking_id", bookingIds)
        .order("sort_order", { ascending: true });
      if (cancelled || error) return;
      const grouped: Record<string, any[]> = {};
      (data || []).forEach((row: any) => {
        if (row.is_internal) return;
        if (!grouped[row.booking_id]) grouped[row.booking_id] = [];
        grouped[row.booking_id].push(row);
      });
      setMarginLinesByBooking(grouped);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookings]);

  // Load QBO sync status for paid payments (which payments have a qbo_payments row)
  useEffect(() => {
    const paidIds = payments.filter((p) => p.status === "paid").map((p) => p.id);
    if (paidIds.length === 0) {
      setQboSyncedIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("qbo_payments")
        .select("crm_payment_id")
        .in("crm_payment_id", paidIds);
      if (cancelled || error) return;
      setQboSyncedIds(new Set((data || []).map((r: any) => r.crm_payment_id).filter(Boolean)));
    })();
    return () => {
      cancelled = true;
    };
  }, [payments, repullingQBO]);

  const paidPayments = payments.filter((p) => p.status === "paid");
  const unsyncedCount = paidPayments.filter((p) => !qboSyncedIds.has(p.id)).length;
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null);
  const [invoicePreviewNumber, setInvoicePreviewNumber] = useState<string | undefined>();
  const [invoicePreviewError, setInvoicePreviewError] = useState(false);

  const handleCreatePaymentLink = async (paymentId: string) => {
    setCreatingPaymentLink(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke("create-stripe-payment", {
        body: { paymentId },
      });
      if (error) throw error;
      if (data?.url) {
        await navigator.clipboard.writeText(data.url);
        toast.success("Payment link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error creating payment link:", error);
      toast.error("Failed to create payment link");
    } finally {
      setCreatingPaymentLink(null);
    }
  };

  const { handlePaymentStatusChange } = useWorkflowAutomation();

  const handleMarkAsPaid = async (paymentId: string) => {
    const payment = payments.find((p) => p.id === paymentId);
    const paymentDate = new Date().toISOString().split("T")[0];
    await updatePayment(paymentId, {
      status: "paid",
      payment_date: paymentDate,
    });

    // Auto-apply this payment against the trip's other pending installments
    // (the source row is excluded by id inside the helper).
    if (payment) {
      const result = await applyPaymentToInstallments({
        tripId,
        sourcePaymentId: paymentId,
        amount: Number(payment.amount) || 0,
        paymentDate,
      });
      if (result.markedPaid > 0 || result.reducedRemainder > 0) {
        const parts: string[] = [];
        if (result.markedPaid > 0) parts.push(`${result.markedPaid} installment${result.markedPaid === 1 ? "" : "s"} marked paid`);
        if (result.reducedRemainder > 0) parts.push(`$${result.reducedRemainder.toFixed(2)} applied to next installment`);
        toast.success(`Payment applied — ${parts.join("; ")}`);
      }
    }

    onDataChange?.();

    // Auto-transition trip status based on payment type
    if (payment && tripStatus && onStatusChange) {
      const newStatus = await handlePaymentStatusChange(tripId, payment.payment_type, tripStatus);
      if (newStatus) {
        await onStatusChange(newStatus);
      }
    }
  };

  // Get supplier name from the first booking if available
  const primarySupplier = bookings.find(b => b.suppliers?.name)?.suppliers?.name;

  const getInvoiceData = (invoiceNumber?: string): InvoiceData => ({
    invoiceNumber,
    tripName: tripName || "Trip",
    clientName: clientName || "Client",
    clientEmail,
    clientPhone,
    destination,
    departDate,
    returnDate,
    payments,
    tripTotal,
    totalPaid,
    totalRemaining: Math.max((tripTotal || 0) - (totalPaid || 0), 0),
    agencyName: brandingSettings?.agency_name || "Crestwell Travel Services",
    agencyPhone: brandingSettings?.phone || undefined,
    agencyEmail: brandingSettings?.email_address || undefined,
    agencyAddress: brandingSettings?.address || undefined,
    agencyWebsite: brandingSettings?.website || undefined,
    agencyLogoUrl: brandingSettings?.logo_url || undefined,
    supplierName: primarySupplier,
    lineItems: bookings
      .filter((b) => b.status !== "cancelled")
      .map((b) => {
        const lines = marginLinesByBooking[b.id] || [];
        return {
          description:
            b.suppliers?.name
              ? `${b.suppliers.name}${b.destination ? ` — ${b.destination}` : ""}`
              : b.trip_name || b.destination || "Booking",
          reference: b.supplier_confirmation_number || b.confirmation_number || b.booking_reference || undefined,
          supplier: b.suppliers?.supplier_type || undefined,
          status: b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1) : undefined,
          amount: Number(b.gross_sales || b.total_price || 0),
          subItems: lines.map((l) => ({
            description: l.description || "Item",
            quantity: Number(l.quantity || 1),
            unitPrice: Number(l.unit_sell || 0),
            amount: Number(l.total_sell || 0),
            isPassThrough: !!l.is_pass_through,
          })),
        };
      }),
  });

  const handleGenerateInvoice = async () => {
    setGeneratingInvoice(true);
    setInvoicePreviewOpen(true);
    setInvoicePreviewUrl(null);
    setInvoicePreviewError(false);
    try {
      // createInvoice internally calls getNextInvoiceNumber, so we only call it once
      const invoice = await createInvoice({
        trip_id: tripId,
        client_id: clientId,
        trip_name: tripName,
        client_name: clientName,
        total_amount: tripTotal,
        amount_paid: totalPaid,
        amount_remaining: Math.max((tripTotal || 0) - (totalPaid || 0), 0),
      });

      if (!invoice) {
        setInvoicePreviewOpen(false);
        return;
      }

      const invoiceNumber = invoice.invoice_number;

      const blobUrl = await generateInvoicePDF(getInvoiceData(invoiceNumber), { returnBlobUrl: true });
      if (blobUrl && typeof blobUrl === "string") {
        setInvoicePreviewUrl(blobUrl);
        setInvoicePreviewNumber(invoiceNumber);
      } else {
        throw new Error("PDF generation returned no URL");
      }
      toast.success(`Invoice ${invoiceNumber} generated`);
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice");
      setInvoicePreviewError(true);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleEmailInvoice = async () => {
    if (!clientEmail) {
      toast.error("Client email address is required to send invoice");
      return;
    }

    setSendingEmail(true);
    try {
      // Get sequential invoice number and create invoice record
      const invoiceNumber = await getNextInvoiceNumber();
      if (!invoiceNumber) {
        toast.error("Failed to generate invoice number");
        return;
      }

      // Create invoice record in database
      await createInvoice({
        trip_id: tripId,
        client_id: clientId,
        trip_name: tripName,
        client_name: clientName,
        total_amount: tripTotal,
        amount_paid: totalPaid,
        amount_remaining: Math.max((tripTotal || 0) - (totalPaid || 0), 0),
      });

      // Generate PDF as base64
      const pdfBase64 = await generateInvoicePDF(getInvoiceData(invoiceNumber), { returnBase64: true });
      
      if (!pdfBase64) {
        throw new Error("Failed to generate PDF");
      }

      const dateRange = departDate && returnDate
        ? `${format(parseLocalDate(departDate), "MMM d, yyyy")} - ${format(parseLocalDate(returnDate), "MMM d, yyyy")}`
        : departDate
        ? format(parseLocalDate(departDate), "MMM d, yyyy")
        : "";

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: clientEmail,
          subject: `Invoice ${invoiceNumber} for ${tripName || "Your Trip"}`,
          template: "invoice",
          data: {
            clientName: clientName || "Valued Client",
            tripName: tripName || "Your Trip",
            destination: destination || "",
            dates: dateRange,
            tripTotal: formatCurrency(tripTotal),
            totalPaid: formatCurrency(totalPaid),
            totalRemaining: formatCurrency(Math.max((tripTotal || 0) - (totalPaid || 0), 0)),
            invoiceNumber,
          },
          attachments: [
            {
              filename: `${invoiceNumber.replace(/-/g, "_")}_${(tripName || "Trip").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
              content: pdfBase64,
            },
          ],
        },
      });

      if (error) throw error;

      toast.success(`Invoice ${invoiceNumber} sent to ${clientEmail}`);
    } catch (error) {
      console.error("Error sending invoice:", error);
      toast.error("Failed to send invoice email");
    } finally {
      setSendingEmail(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleRepullFromQBO = async () => {
    setRepullingQBO(true);
    try {
      const { error } = await supabase.functions.invoke("qbo-cache-sync", {
        body: { objects: ["invoices", "payments"] },
      });
      if (error) throw error;
      toast.success("Refreshed invoice & payment data from QBO");
      onDataChange?.();
    } catch (err) {
      console.error("QBO re-pull failed:", err);
      toast.error("Failed to re-pull from QBO");
    } finally {
      setRepullingQBO(false);
    }
  };

  const getPaymentLabel = (payment: TripPayment) => {
    if (payment.bookings) {
      const supplier = payment.bookings.suppliers?.name || "";
      const destination = (payment.bookings as any).destination || "";
      const tripName = (payment.bookings as any).trip_name || "";
      return tripName || `${supplier} - ${destination}`.trim() || payment.bookings.confirmation_number;
    }
    return "Trip Payment";
  };

  const expectedPayments = payments.filter((p) => p.status === "pending");
  const pastPayments = payments.filter((p) => p.status !== "pending");

  const progressPercentage = tripTotal > 0 ? Math.min((totalPaid / tripTotal) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Expected Payments */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Expected Payments</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshPayments}
                disabled={refreshing}
                title="Reload paid/remaining totals from the database"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
              {paidPayments.length > 0 && (
                <Badge
                  variant="outline"
                  className={
                    unsyncedCount > 0
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-green-100 text-green-700 border-green-200"
                  }
                  title={
                    unsyncedCount > 0
                      ? `${unsyncedCount} of ${paidPayments.length} paid payments not yet pushed to QBO`
                      : "All paid payments are synced to QBO"
                  }
                >
                  {unsyncedCount > 0 ? (
                    <CloudOff className="h-3 w-3 mr-1" />
                  ) : (
                    <Cloud className="h-3 w-3 mr-1" />
                  )}
                  QBO: {paidPayments.length - unsyncedCount}/{paidPayments.length} synced
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRepullFromQBO}
                disabled={repullingQBO}
                title="Force re-pull invoice & payment data from QuickBooks"
              >
                {repullingQBO ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Re-pull from QBO
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEmailInvoice}
                disabled={sendingEmail || !clientEmail}
                title={!clientEmail ? "Client email required" : "Email invoice to client"}
              >
                {sendingEmail ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Email Invoice
              </Button>
              <Button variant="outline" size="sm" onClick={handleGenerateInvoice} disabled={generatingInvoice}>
                {generatingInvoice ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate Invoice
              </Button>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Log Payment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {expectedPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No unpaid payments</p>
                <p className="text-sm mt-1">Add expected payments to track what's due</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-sm text-muted-foreground">Item</th>
                      <th className="pb-3 font-medium text-sm text-muted-foreground">Payment</th>
                      <th className="pb-3 font-medium text-sm text-muted-foreground">Due</th>
                      <th className="pb-3 font-medium text-sm text-muted-foreground">Expected</th>
                      <th className="pb-3 font-medium text-sm text-muted-foreground">Remaining</th>
                      <th className="pb-3 font-medium text-sm text-muted-foreground">Status</th>
                      <th className="pb-3 font-medium text-sm text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {expectedPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-muted/50">
                        <td className="py-3">
                          <p className="font-medium text-primary">{getPaymentLabel(payment)}</p>
                        </td>
                        <td className="py-3 text-sm text-muted-foreground">
                          {payment.payment_type === "final_balance" ? "Final balance" : 
                           payment.payment_type.charAt(0).toUpperCase() + payment.payment_type.slice(1)}
                        </td>
                        <td className="py-3 text-sm">
                          {payment.due_date ? format(parseLocalDate(payment.due_date), "MMM d, yyyy") : "-"}
                        </td>
                        <td className="py-3 font-medium">{formatCurrency(payment.amount)}</td>
                        <td className="py-3 font-medium">{formatCurrency(payment.amount)}</td>
                        <td className="py-3">
                          <Badge variant="outline" className={statusColors[payment.status]}>
                            {payment.status === "pending" ? "Unpaid" : payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </Badge>
                          {payment.status === "paid" && (
                            <div className="mt-1">
                              {qboSyncedIds.has(payment.id) ? (
                                <span className="inline-flex items-center text-xs text-green-700" title="Pushed to QBO">
                                  <Cloud className="h-3 w-3 mr-1" /> QBO synced
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-xs text-amber-700" title="Not yet pushed to QBO — will be sent on next sync">
                                  <CloudOff className="h-3 w-3 mr-1" /> Not in QBO
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={() => handleCreatePaymentLink(payment.id)}
                                  disabled={creatingPaymentLink === payment.id}
                                >
                                  {creatingPaymentLink === payment.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : payment.stripe_payment_url ? (
                                    <Copy className="h-4 w-4" />
                                  ) : (
                                    <ExternalLink className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {payment.stripe_payment_url ? "Copy Payment Link" : "Create Payment Link"}
                              </TooltipContent>
                            </Tooltip>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => handleMarkAsPaid(payment.id)}
                              disabled={updating}
                              title="Mark as Paid"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this payment record.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => { await deletePayment(payment.id); onDataChange?.(); }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trip Totals Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trip Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Total cost</span>
                <span className="text-xl font-bold">{formatCurrency(tripTotal)}</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm">Paid</span>
                </div>
                <span className="font-medium">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent" />
                  <span className="text-sm">Authorized</span>
                </div>
                <span className="font-medium">{formatCurrency(totalAuthorized)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                  <span className="text-sm">Remaining</span>
                </div>
                <span className="font-medium">{formatCurrency(totalRemaining)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Past Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Past Payments and Authorizations</CardTitle>
        </CardHeader>
        <CardContent>
          {pastPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No past payments recorded</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Item</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Amount</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Date</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Details</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Status</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pastPayments.map((payment) => {
                    // Resolve supplier name from the linked booking
                    const paymentSupplier = payment.bookings?.suppliers?.name;
                    return (
                      <tr key={payment.id} className="hover:bg-muted/50">
                        <td className="py-3">
                          <p className="font-medium text-primary">{getPaymentLabel(payment)}</p>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{formatCurrency(payment.amount)}</span>
                          </div>
                        </td>
                        <td className="py-3 text-sm">
                          {format(parseLocalDate(payment.payment_date), "MMM d, yyyy")}
                        </td>
                        <td className="py-3 text-sm text-primary">
                          {payment.details || "-"}
                        </td>
                        <td className="py-3">
                          <Badge variant="outline" className={statusColors[payment.status]}>
                            {payment.status === "pending" ? "Unpaid" : payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </Badge>
                        </td>
                        {/* Virtual Card Actions:
                            - Affirm VCN: shown for paid payments where agent can issue an Affirm card */}
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            {/* Only show Affirm button for explicit Affirm payments or non-Stripe paid payments */}
                            {payment.payment_method_choice === "affirm" && (
                              <AffirmVirtualCardButton
                                paymentStatus={payment.status}
                                amount={payment.amount}
                                orderId={payment.id}
                                clientName={clientName}
                                clientEmail={clientEmail}
                                clientPhone={clientPhone}
                                supplierName={paymentSupplier}
                                tripName={tripName}
                              />
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this {payment.status} payment record of {formatCurrency(payment.amount)}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => { await deletePayment(payment.id); onDataChange?.(); }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddPaymentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        tripId={tripId}
        bookings={bookings}
        onPaymentCreated={onDataChange}
      />

      <InvoicePreviewDialog
        open={invoicePreviewOpen}
        onOpenChange={(open) => {
          setInvoicePreviewOpen(open);
          if (!open && invoicePreviewUrl) {
            URL.revokeObjectURL(invoicePreviewUrl);
            setInvoicePreviewUrl(null);
          }
          if (!open) setInvoicePreviewError(false);
        }}
        pdfUrl={invoicePreviewUrl}
        invoiceNumber={invoicePreviewNumber}
        generating={generatingInvoice}
        error={invoicePreviewError}
      />
    </div>
  );
}
