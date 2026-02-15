import { usePortalTrips } from "@/hooks/usePortalData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { MapPin, Calendar } from "lucide-react";

export default function PortalTrips() {
  const { data, isLoading } = usePortalTrips();
  const trips = data?.trips || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Trips</h1>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No trips found. Your travel agent will add trips here once they're booked.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trips.map((trip: any) => (
            <Link key={trip.id} to={`/client/trips/${trip.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">{trip.trip_name}</h3>
                      {trip.destination && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {trip.destination}
                        </p>
                      )}
                      {trip.depart_date && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(trip.depart_date), "MMM d")}
                          {trip.return_date && ` – ${format(new Date(trip.return_date), "MMM d, yyyy")}`}
                        </p>
                      )}
                    </div>
                    <Badge variant={trip.status === "confirmed" ? "default" : "secondary"}>
                      {trip.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
