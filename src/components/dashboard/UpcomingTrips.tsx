import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, MapPin } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Panel, PanelHeader, PanelBody, EmptyState } from "@/components/patterns/Panel";
import { SemanticStatusPill } from "@/components/patterns/StatusPill";

interface UpcomingTrip {
  id: string;
  trip_name?: string | null;
  destination?: string | null;
  depart_date?: string | null;
  clients?: { name: string } | null;
}

interface UpcomingTripsProps {
  trips: UpcomingTrip[];
  loading?: boolean;
}

export function UpcomingTrips({ trips, loading }: UpcomingTripsProps) {
  const navigate = useNavigate();

  return (
    <Panel className="lg:col-span-2">
      <PanelHeader
        title="Upcoming Trips"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/trips")} className="text-[13px] text-muted-foreground hover:text-foreground">
            View All <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        }
      />
      <PanelBody>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-[9px]" />)}
          </div>
        ) : trips.length === 0 ? (
          <EmptyState title="No upcoming trips" message="Trips departing in the next 30 days will show up here." />
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => {
              const daysUntil = differenceInDays(new Date(trip.depart_date!), new Date());
              return (
                <div
                  key={trip.id}
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  className="flex items-center justify-between gap-3 rounded-[9px] border border-border p-3 transition-colors hover:bg-muted/30 cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-foreground">
                        {trip.clients?.name || "Client"} – {trip.trip_name || trip.destination}
                      </p>
                      <p className="text-[12.5px] text-muted-foreground">
                        Departure: {format(new Date(trip.depart_date!), "MMM d")}
                      </p>
                    </div>
                  </div>
                  <SemanticStatusPill
                    status={daysUntil <= 0 ? "destructive" : daysUntil <= 7 ? "warning" : "muted"}
                    label={daysUntil <= 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                    className="shrink-0"
                  />
                </div>
              );
            })}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
