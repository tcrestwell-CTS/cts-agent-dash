import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { TripItinerary } from "@/components/trips/TripItinerary";
import { useTrip } from "@/hooks/useTrips";

const ItineraryBuilder = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { trip, bookings, loading } = useTrip(tripId);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
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
          <Button variant="outline" className="mt-4" onClick={() => navigate("/trips")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Trips
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/trips/${tripId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Itinerary Builder</h1>
            <p className="text-muted-foreground text-sm">
              {trip.trip_name}
              {trip.destination && ` · ${trip.destination}`}
            </p>
          </div>
        </div>

        <TripItinerary
          tripId={tripId!}
          destination={trip.destination}
          departDate={trip.depart_date}
          returnDate={trip.return_date}
          tripName={trip.trip_name}
          bookings={bookings}
        />
      </div>
    </DashboardLayout>
  );
};

export default ItineraryBuilder;
