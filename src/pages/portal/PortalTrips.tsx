import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortalTrips } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function PortalTrips() {
  const { data, isLoading } = usePortalTrips();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "traveling": return "bg-green-100 text-green-800";
      case "booked": return "bg-blue-100 text-blue-800";
      case "planning": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-gray-100 text-gray-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </PortalLayout>
    );
  }

  const trips = data?.trips || [];

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Trips</h1>
          <p className="text-muted-foreground mt-1">View all your travel plans</p>
        </div>

        {trips.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Compass className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No trips yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {trips.map((trip: any) => (
              <Link key={trip.id} to={`/trips/${trip.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="space-y-1">
                      <p className="font-semibold text-lg text-foreground">{trip.trip_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {trip.destination || "Destination TBD"}
                      </p>
                      {trip.depart_date && (
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(trip.depart_date), "MMM d")}
                          {trip.return_date && ` – ${format(new Date(trip.return_date), "MMM d, yyyy")}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={getStatusColor(trip.status)} variant="secondary">
                        {trip.status}
                      </Badge>
                      {trip.total_gross_sales > 0 && (
                        <span className="text-lg font-semibold text-foreground">
                          ${Number(trip.total_gross_sales).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
