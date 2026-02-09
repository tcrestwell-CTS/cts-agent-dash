import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Plane, Ship, Car, Hotel, Umbrella, Trash2 } from "lucide-react";
import { TripBooking } from "@/hooks/useTrips";
import { useTripPayments } from "@/hooks/useTripPayments";
import { format } from "date-fns";
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
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface TripBookingsProps {
  tripId: string;
  bookings: TripBooking[];
  tripTotal: number;
  totalCommission: number;
}

// Map supplier types to icons and colors
const supplierTypeConfig: Record<string, { icon: typeof Building2; color: string }> = {
  airline: { icon: Plane, color: "bg-sky-500" },
  flight: { icon: Plane, color: "bg-sky-500" },
  hotel: { icon: Hotel, color: "bg-rose-500" },
  lodging: { icon: Hotel, color: "bg-rose-500" },
  cruise: { icon: Ship, color: "bg-teal-500" },
  transfer: { icon: Car, color: "bg-amber-500" },
  car_rental: { icon: Car, color: "bg-amber-500" },
  tour: { icon: Umbrella, color: "bg-purple-500" },
  insurance: { icon: Umbrella, color: "bg-green-500" },
};

export function TripBookings({ tripId, bookings, tripTotal, totalCommission }: TripBookingsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { totalPaid, totalAuthorized } = useTripPayments(tripId);

  const unpaid = tripTotal - totalPaid - totalAuthorized;

  const handleRemoveBooking = async (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", bookingId);

      if (error) throw error;

      toast.success("Booking removed from trip");
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    } catch (error: any) {
      toast.error("Failed to remove booking: " + error.message);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getSupplierIcon = (supplierType: string | undefined) => {
    const type = supplierType?.toLowerCase() || "other";
    const config = supplierTypeConfig[type] || { icon: Building2, color: "bg-muted-foreground" };
    const Icon = config.icon;
    return (
      <div className={`w-6 h-6 rounded flex items-center justify-center ${config.color}`}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
    );
  };

  const getPaymentStatus = (booking: TripBooking) => {
    // For now, we'll show "Paid" or "Pending" based on booking status
    // This could be enhanced to check actual payments against bookings
    if (booking.status === "completed" || booking.status === "confirmed") {
      return <span className="text-primary font-medium">Paid</span>;
    }
    return <span className="text-muted-foreground">Pending</span>;
  };

  const getCommissionStatus = (booking: TripBooking) => {
    // Commission is "Upcoming" until the trip is completed
    if (booking.status === "completed") {
      return <span className="text-primary font-medium">Paid</span>;
    }
    return <span className="text-muted-foreground">Upcoming</span>;
  };

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total cost</p>
            <p className="text-xl font-semibold">{formatCurrency(tripTotal)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Paid</p>
            <p className="text-xl font-semibold text-primary">{formatCurrency(totalPaid)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Authorized</p>
            <p className={`text-xl font-semibold ${totalAuthorized === 0 ? "text-destructive" : "text-primary"}`}>
              {formatCurrency(totalAuthorized)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Unpaid</p>
            <p className="text-xl font-semibold">{formatCurrency(unpaid > 0 ? unpaid : 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Exp. commission after split</p>
            <p className="text-xl font-semibold">{formatCurrency(totalCommission)}</p>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Bookings</CardTitle>
          <Button size="sm" onClick={() => navigate("/bookings")}>
            <Plus className="h-4 w-4 mr-2" />
            New Item
          </Button>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No bookings in this trip yet</p>
              <p className="text-sm mt-1">Add bookings to track hotels, flights, and more</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Item</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Cost</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Supplier</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Confirmation #</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Payment</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Commission</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/bookings/${booking.id}`)}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          {getSupplierIcon(booking.suppliers?.supplier_type)}
                          <span className="font-medium text-primary">
                            {booking.trip_name || booking.destination}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">{formatCurrency(booking.gross_sales)}</td>
                      <td className="py-3">
                        <span className="text-primary hover:underline">
                          {booking.suppliers?.name || "-"}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-sm text-primary">
                        {booking.booking_reference}
                      </td>
                      <td className="py-3">{getPaymentStatus(booking)}</td>
                      <td className="py-3">{getCommissionStatus(booking)}</td>
                      <td className="py-3">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Booking</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove "{booking.trip_name || booking.destination}" from this trip? 
                                This will permanently delete the booking and update the trip totals.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={(e) => handleRemoveBooking(booking.id, e)}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
