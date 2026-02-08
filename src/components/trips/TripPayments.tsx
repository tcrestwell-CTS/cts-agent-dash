import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Plus, CreditCard, DollarSign, Trash2, Edit, Receipt } from "lucide-react";
import { useTripPayments, TripPayment } from "@/hooks/useTripPayments";
import { TripBooking } from "@/hooks/useTrips";
import { format } from "date-fns";
import { AddPaymentDialog } from "./AddPaymentDialog";
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
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  paid: "bg-green-100 text-green-700 border-green-200",
  authorized: "bg-blue-100 text-blue-700 border-blue-200",
  refunded: "bg-purple-100 text-purple-700 border-purple-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

export function TripPayments({ tripId, bookings, tripTotal }: TripPaymentsProps) {
  const {
    payments,
    loading,
    deletePayment,
    totalPaid,
    totalAuthorized,
    totalRemaining,
  } = useTripPayments(tripId);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

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
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Item
            </Button>
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
