import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Plus, CreditCard, DollarSign, Trash2, Check, Receipt, FileText, Mail, Loader2 } from "lucide-react";
import { useTripPayments, TripPayment } from "@/hooks/useTripPayments";
import { TripBooking } from "@/hooks/useTrips";
import { format } from "date-fns";
import { AddPaymentDialog } from "./AddPaymentDialog";
import { generateInvoicePDF, InvoiceData } from "@/lib/invoiceGenerator";
import { useBrandingSettings } from "@/hooks/useBrandingSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  bookings: TripBooking[];
  tripTotal: number;
  tripName?: string;
  clientName?: string;
  clientEmail?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
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
  bookings, 
  tripTotal,
  tripName,
  clientName,
  clientEmail,
  destination,
  departDate,
  returnDate,
}: TripPaymentsProps) {
  const {
    payments,
    loading,
    updatePayment,
    updating,
    deletePayment,
    totalPaid,
    totalAuthorized,
    totalRemaining,
  } = useTripPayments(tripId);
  const { settings: brandingSettings } = useBrandingSettings();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleMarkAsPaid = async (paymentId: string) => {
    await updatePayment(paymentId, {
      status: "paid",
      payment_date: new Date().toISOString().split("T")[0],
    });
  };

  const getInvoiceData = (): InvoiceData => ({
    tripName: tripName || "Trip",
    clientName: clientName || "Client",
    clientEmail,
    destination,
    departDate,
    returnDate,
    payments,
    tripTotal,
    totalPaid,
    totalRemaining,
    agencyName: brandingSettings?.agency_name || "Crestwell Travel Services",
    agencyPhone: brandingSettings?.phone || undefined,
    agencyEmail: brandingSettings?.email_address || undefined,
    agencyAddress: brandingSettings?.address || undefined,
  });

  const handleGenerateInvoice = () => {
    generateInvoicePDF(getInvoiceData());
  };

  const handleEmailInvoice = async () => {
    if (!clientEmail) {
      toast.error("Client email address is required to send invoice");
      return;
    }

    setSendingEmail(true);
    try {
      // Generate PDF as base64
      const pdfBase64 = generateInvoicePDF(getInvoiceData(), { returnBase64: true });
      
      if (!pdfBase64) {
        throw new Error("Failed to generate PDF");
      }

      const dateRange = departDate && returnDate
        ? `${format(new Date(departDate), "MMM d, yyyy")} - ${format(new Date(returnDate), "MMM d, yyyy")}`
        : departDate
        ? format(new Date(departDate), "MMM d, yyyy")
        : "";

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: clientEmail,
          subject: `Invoice for ${tripName || "Your Trip"}`,
          template: "invoice",
          data: {
            clientName: clientName || "Valued Client",
            tripName: tripName || "Your Trip",
            destination: destination || "",
            dates: dateRange,
            tripTotal: formatCurrency(tripTotal),
            totalPaid: formatCurrency(totalPaid),
            totalRemaining: formatCurrency(totalRemaining),
          },
          attachments: [
            {
              filename: `Invoice_${(tripName || "Trip").replace(/[^a-zA-Z0-9]/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`,
              content: pdfBase64,
            },
          ],
        },
      });

      if (error) throw error;

      toast.success(`Invoice sent to ${clientEmail}`);
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

  const getPaymentLabel = (payment: TripPayment) => {
    if (payment.bookings) {
      const supplier = payment.bookings.suppliers?.name || "";
      const destination = payment.bookings.destination || "";
      const tripName = payment.bookings.trip_name || "";
      return tripName || `${supplier} - ${destination}`.trim() || payment.bookings.booking_reference;
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
              <Button variant="outline" size="sm" onClick={handleGenerateInvoice}>
                <FileText className="h-4 w-4 mr-2" />
                Download Invoice
              </Button>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {expectedPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No pending payments</p>
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
                          {payment.due_date ? format(new Date(payment.due_date), "MMM d, yyyy") : "-"}
                        </td>
                        <td className="py-3 font-medium">{formatCurrency(payment.amount)}</td>
                        <td className="py-3 font-medium">{formatCurrency(payment.amount)}</td>
                        <td className="py-3">
                          <Badge variant="outline" className={statusColors[payment.status]}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
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
                                    onClick={() => deletePayment(payment.id)}
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
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pastPayments.map((payment) => (
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
                        {format(new Date(payment.payment_date), "MMM d, yyyy")}
                      </td>
                      <td className="py-3 text-sm text-primary">
                        {payment.details || "-"}
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className={statusColors[payment.status]}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
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
      />
    </div>
  );
}
