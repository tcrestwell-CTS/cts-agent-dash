import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plane, Calendar, Users, MapPin } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { format, addDays, isWithinInterval, isFuture } from "date-fns";

export function UpcomingDepartures() {
  const navigate = useNavigate();
  const { bookings, loading } = useBookings();

  const today = new Date();
  const thirtyDaysFromNow = addDays(today, 30);

  const upcomingDepartures = bookings
    .filter((booking) => {
      const departDate = new Date(booking.depart_date);
      return (
        booking.status !== "cancelled" &&
        isFuture(departDate) &&
        isWithinInterval(departDate, { start: today, end: thirtyDaysFromNow })
      );
    })
    .sort((a, b) => new Date(a.depart_date).getTime() - new Date(b.depart_date).getTime())
    .slice(0, 5);

  const getDaysUntilDeparture = (departDate: string) => {
    const days = Math.ceil(
      (new Date(departDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days} days`;
  };

  const getUrgencyColor = (departDate: string) => {
    const days = Math.ceil(
      (new Date(departDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days <= 3) return "bg-destructive/10 text-destructive border-destructive/20";
    if (days <= 7) return "bg-accent/10 text-accent border-accent/20";
    return "bg-primary/10 text-primary border-primary/20";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          Upcoming Departures
        </CardTitle>
        <p className="text-sm text-muted-foreground">Next 30 days</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : upcomingDepartures.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Plane className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No departures in the next 30 days</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingDepartures.map((booking) => (
              <div
                key={booking.id}
                onClick={() => navigate(`/bookings/${booking.id}`)}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${getUrgencyColor(booking.depart_date)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">
                        {booking.trip_name || booking.destination}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {booking.booking_reference}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {booking.destination}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(booking.depart_date), "MMM d")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {booking.travelers}
                      </span>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className="shrink-0 font-semibold"
                  >
                    {getDaysUntilDeparture(booking.depart_date)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
