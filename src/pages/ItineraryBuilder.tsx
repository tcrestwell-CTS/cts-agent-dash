import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Rows3, Columns3 } from "lucide-react";
import { TripItinerary } from "@/components/trips/TripItinerary";
import { useTrip } from "@/hooks/useTrips";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ItineraryBuilder = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { trip, bookings, loading } = useTrip(tripId);
  const [layout, setLayout] = useState<"vertical" | "horizontal">("vertical");

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
        <div className="flex items-center justify-between">
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

          <TooltipProvider>
            <div className="flex items-center rounded-lg border bg-muted p-1 gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={layout === "vertical" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setLayout("vertical")}
                  >
                    <Rows3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vertical layout</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={layout === "horizontal" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setLayout("horizontal")}
                  >
                    <Columns3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Horizontal layout</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <TripItinerary
          tripId={tripId!}
          destination={trip.destination}
          departDate={trip.depart_date}
          returnDate={trip.return_date}
          tripName={trip.trip_name}
          bookings={bookings}
          layout={layout}
        />
      </div>
    </DashboardLayout>
  );
};

export default ItineraryBuilder;
