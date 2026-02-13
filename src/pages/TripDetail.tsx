import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Users,
  MapPin,
  DollarSign,
  ExternalLink,
  Plus,
  Trash2,
  Edit,
  Building2,
  CreditCard,
  Map,
  Link2,
  Loader2,
} from "lucide-react";
import { TripPayments } from "@/components/trips/TripPayments";
import { TripBookings } from "@/components/trips/TripBookings";
import { TripItinerary } from "@/components/trips/TripItinerary";
import { TripStatusWorkflow } from "@/components/trips/TripStatusWorkflow";
import { PublishTripButton } from "@/components/trips/PublishTripButton";
import { useTrip, useTrips } from "@/hooks/useTrips";
import { useTripPayments } from "@/hooks/useTripPayments";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
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

const statusColors: Record<string, string> = {
  planning: "bg-blue-100 text-blue-700 border-blue-200",
  booked: "bg-green-100 text-green-700 border-green-200",
  traveling: "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};

const bookingStatusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  traveling: "bg-purple-100 text-purple-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

const TripDetail = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "bookings";
  const { trip, bookings, loading, removeBookingFromTrip, updateTripStatus, updatingStatus, fetchTrip } = useTrip(tripId);
  const { deleteTrip } = useTrips();
  const { payments } = useTripPayments(tripId);
  const hasPayments = payments.length > 0;
  const [isSendingPortalLink, setIsSendingPortalLink] = useState(false);

  // Refresh trip data when page gains focus (e.g. returning from client/booking edit)
  useEffect(() => {
    const handleFocus = () => {
      fetchTrip();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchTrip]);

  const handleSendPortalLink = async () => {
    if (!trip?.clients?.email) {
      toast.error("Client has no email address");
      return;
    }
    setIsSendingPortalLink(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "send-magic-link", email: trip.clients.email }),
        }
      );
      if (!res.ok) throw new Error("Failed to send");
      toast.success(`Portal access link sent to ${trip.clients.email}`);
    } catch {
      toast.error("Failed to send portal link");
    } finally {
      setIsSendingPortalLink(false);
    }
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleDelete = async () => {
    if (trip) {
      const success = await deleteTrip(trip.id);
      if (success) {
        navigate("/trips");
      }
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-48 lg:col-span-2" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!trip) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive font-medium">Trip not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/trips")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trips
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <h1 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Trip Details</h1>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/trips")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{trip.trip_name}</h2>
                <Badge
                  variant="outline"
                  className={statusColors[trip.status] || statusColors.planning}
                >
                  {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {trip.clients?.name || "Unknown Client"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PublishTripButton
              tripId={trip.id}
              shareToken={(trip as any).share_token}
              publishedAt={(trip as any).published_at}
              updatedAt={trip.updated_at}
              onPublished={fetchTrip}
            />
            {trip.trip_page_url && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={trip.trip_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Trip Page
                </a>
              </Button>
            )}
            {hasPayments ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="outline" size="sm" className="text-muted-foreground" disabled>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove all payments before deleting this trip</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Trip?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this trip. Bookings will be
                      unlinked but not deleted. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Status Workflow */}
        <TripStatusWorkflow
          currentStatus={trip.status}
          onStatusChange={updateTripStatus}
          disabled={updatingStatus}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Trip Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Trip Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {trip.destination && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="text-muted-foreground">Destination:</span>{" "}
                      {trip.destination}
                    </span>
                  </div>
                )}
                {trip.depart_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="text-muted-foreground">Dates:</span>{" "}
                      {format(new Date(trip.depart_date), "MMM d, yyyy")}
                      {trip.return_date && (
                        <> - {format(new Date(trip.return_date), "MMM d, yyyy")}</>
                      )}
                    </span>
                  </div>
                )}
                {trip.trip_type && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      <span className="text-muted-foreground">Type:</span>{" "}
                      {trip.trip_type.charAt(0).toUpperCase() +
                        trip.trip_type.slice(1).replace("_", " ")}
                    </span>
                  </div>
                )}
              </div>
              {trip.notes && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{trip.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Trip Financials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Gross Sales</span>
                <span className="font-semibold">
                  {formatCurrency(trip.total_gross_sales)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">
                  Commissionable
                </span>
                <span className="font-medium">
                  {formatCurrency(trip.total_commissionable_amount)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">
                  Commission Revenue
                </span>
                <span className="font-semibold text-primary">
                  {formatCurrency(trip.total_commission_revenue)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">
                  Supplier Payout
                </span>
                <span className="font-medium">
                  {formatCurrency(trip.total_supplier_payout)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Traveler Info */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Travelers
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/contacts/${trip.client_id}`}>View Client Profile</Link>
            </Button>
            {trip.clients?.email && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendPortalLink}
                disabled={isSendingPortalLink}
              >
                {isSendingPortalLink ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                Send Portal Link
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="font-semibold text-primary">
                  {trip.clients?.name?.charAt(0).toUpperCase() || "?"}
                </span>
              </div>
              <div>
                <p className="font-medium">{trip.clients?.name || "Unknown"}</p>
                {trip.clients?.email && (
                  <p className="text-sm text-muted-foreground">
                    {trip.clients.email}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Bookings and Payments */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="itinerary" className="flex items-center gap-2">
              <Map className="h-4 w-4" />
              Itinerary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-6">
            <TripBookings
              tripId={tripId!}
              clientId={trip.client_id}
              bookings={bookings}
              tripTotal={trip.total_gross_sales}
              totalCommission={trip.total_commission_revenue}
              destination={trip.destination || undefined}
              departDate={trip.depart_date || undefined}
              returnDate={trip.return_date || undefined}
              onDataChange={fetchTrip}
            />
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <TripPayments
              tripId={tripId!}
              clientId={trip.client_id}
              bookings={bookings}
              tripTotal={trip.total_gross_sales}
              tripName={trip.trip_name}
              clientName={trip.clients?.name}
              clientEmail={trip.clients?.email || undefined}
              clientPhone={trip.clients?.phone || undefined}
              destination={trip.destination || undefined}
              departDate={trip.depart_date || undefined}
              returnDate={trip.return_date || undefined}
              onDataChange={fetchTrip}
            />
          </TabsContent>

          <TabsContent value="itinerary" className="mt-6">
            <TripItinerary
              tripId={tripId!}
              destination={trip.destination}
              departDate={trip.depart_date}
              returnDate={trip.return_date}
              tripName={trip.trip_name}
              bookings={bookings}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default TripDetail;
