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
import { TripCoverImage } from "@/components/trips/TripCoverImage";
import { TripStatusWorkflow } from "@/components/trips/TripStatusWorkflow";
import { TripCloseoutChecklist } from "@/components/trips/TripCloseoutChecklist";
import { PublishTripButton } from "@/components/trips/PublishTripButton";
import { SubTrips } from "@/components/trips/SubTrips";
import { TripSettingsSidebar } from "@/components/trips/TripSettingsSidebar";
import { TripTravelersCard } from "@/components/trips/TripTravelersCard";
import { useTrip, useTrips } from "@/hooks/useTrips";
import { useTripTravelers } from "@/hooks/useTripTravelers";
import { useTripPayments } from "@/hooks/useTripPayments";
import { useProfile } from "@/hooks/useProfile";
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

const TripDetail = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "bookings";
  const { trip, bookings, subTrips, loading, removeBookingFromTrip, updateTripStatus, updatingStatus, fetchTrip } = useTrip(tripId);
  const { deleteTrip } = useTrips();
  const { payments } = useTripPayments(tripId);
  const { profile } = useProfile();
  const { data: tripTravelers = [] } = useTripTravelers(tripId);
  const hasPayments = payments.length > 0;
  const [isSendingPortalLink, setIsSendingPortalLink] = useState(false);

  // Refresh trip data when page gains focus
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

  const isGroupTrip = trip.trip_type === "group";

  const tripSettings = {
    currency: (trip as any).currency || "USD",
    pricing_visibility: (trip as any).pricing_visibility || "show_all",
    tags: (trip as any).tags || [],
    allow_pdf_downloads: (trip as any).allow_pdf_downloads || false,
    itinerary_style: (trip as any).itinerary_style || "vertical_list",
    deposit_required: (trip as any).deposit_required || false,
    deposit_amount: (trip as any).deposit_amount || 0,
  };

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
              onClick={() => navigate(trip.parent_trip_id ? `/trips/${trip.parent_trip_id}` : "/trips")}
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
                {trip.trip_type && (
                  <Badge variant="secondary">
                    {trip.trip_type.charAt(0).toUpperCase() + trip.trip_type.slice(1).replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">
                {trip.clients?.name ||
                  (() => {
                    const primary = tripTravelers.find((t) => t.is_primary) || tripTravelers[0];
                    return primary
                      ? `${primary.first_name}${primary.last_name ? " " + primary.last_name : ""}`
                      : "No client assigned";
                  })()}
              </p>
            </div>
          </div>
        </div>

        {/* Unified Action Bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
          {trip.client_id && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/contacts/${trip.client_id}`}>
                <Users className="h-4 w-4 mr-2" />
                Client Profile
              </Link>
            </Button>
          )}

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

          <Button variant="outline" size="sm" onClick={() => navigate(`/trips/${tripId}/itinerary`)}>
            <Map className="h-4 w-4 mr-2" />
            Itinerary Builder
          </Button>


          <PublishTripButton
            tripId={trip.id}
            shareToken={(trip as any).share_token}
            publishedAt={(trip as any).published_at}
            updatedAt={trip.updated_at}
            onPublished={fetchTrip}
          />

          <div className="flex-1" />

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

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-[1fr_280px] items-start">
          {/* Left / main content */}
          <div className="space-y-6">
            {/* Status Workflow */}
            <TripStatusWorkflow
              currentStatus={trip.status}
              onStatusChange={updateTripStatus}
              disabled={updatingStatus}
            />

            {/* Cover Image */}
            <TripCoverImage
              tripId={trip.id}
              coverImageUrl={(trip as any).cover_image_url}
              onUpdated={fetchTrip}
            />

            {/* Trip Details & Financials */}

            {/* Trip Details & Financials */}
            <div className={isGroupTrip ? "grid gap-6 md:grid-cols-2" : "grid gap-6 lg:grid-cols-3"}>
              <Card className={isGroupTrip ? "" : "lg:col-span-2"}>
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
                  </div>
                  {trip.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{trip.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

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
                    <span className="text-sm text-muted-foreground">Commissionable</span>
                    <span className="font-medium">
                      {formatCurrency(trip.total_commissionable_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Commission Revenue</span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(trip.total_commission_revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Supplier Payout</span>
                    <span className="font-medium">
                      {formatCurrency(trip.total_supplier_payout)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sub-Trips — GROUP TRIPS: primary section, prominent placement */}
            {isGroupTrip && (
              <SubTrips
                parentTripId={trip.id}
                subTrips={subTrips}
                onDataChange={fetchTrip}
              />
            )}




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
            </Tabs>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4 lg:block">
            <div className="sticky top-6 space-y-4">
              <TripTravelersCard
                client={trip.clients}
                clientId={trip.client_id}
                tripId={trip.id}
              />
              {isGroupTrip && (
                <TripSettingsSidebar
                  tripId={trip.id}
                  settings={tripSettings}
                  agencyName={profile?.agency_name || undefined}
                  onSettingsChange={fetchTrip}
                />
              )}
              <TripCloseoutChecklist
                bookings={bookings}
                payments={payments}
                tripTotal={trip.total_gross_sales}
                tripStatus={trip.status}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TripDetail;
