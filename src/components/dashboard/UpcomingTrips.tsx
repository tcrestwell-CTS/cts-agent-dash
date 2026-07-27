import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, MapPin } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Panel, PanelHeader, PanelBody, EmptyState } from "@/components/patterns/Panel";
import { SemanticStatusPill } from "@/components/patterns/StatusPill";
import { formatCurrency } from "@/lib/utils";

interface UpcomingTrip {
  id: string;
  trip_name?: string | null;
  destination?: string | null;
  depart_date?: string | null;
  clients?: { name: string } | null;
  total_gross_sales?: number | null;
  travelers?: number | null;
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
        title="Upcoming departures"
        subtitle="Next 30 days"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/trips")} className="text-[13px] text-muted-foreground hover:text-foreground">
            All trips <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        }
      />
      <PanelBody>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-[9px]" />)}
          </div>
        ) : trips.length === 0 ? (
          <EmptyState title="No upcoming trips" message="Trips departing in the next 30 days will show up here." />
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => {
              const daysUntil = differenceInDays(new Date(trip.depart_date!), new Date());
              const departDate = new Date(trip.depart_date!);
              return (
                <div
                  key={trip.id}
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  className="flex items-center justify-between gap-4 rounded-[12px] border border-border bg-background p-4 transition-colors hover:bg-muted/30 cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[10px] border border-border bg-muted/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {format(departDate, "MMM")}
                      </span>
                      <span className="text-[18px] font-semibold leading-none text-foreground">
                        {format(departDate, "d")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-foreground">
                        {trip.trip_name || trip.destination || "Trip"}
                      </p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {trip.clients?.name || "Client"}
                        {trip.destination ? ` · ${trip.destination}` : ""}
                        {trip.travelers ? ` · ${trip.travelers} pax` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[14px] font-semibold tabular-nums text-foreground">
                      {formatCurrency(trip.total_gross_sales || 0)}
                    </span>
                    <SemanticStatusPill
                      status={daysUntil <= 0 ? "destructive" : daysUntil <= 7 ? "warning" : "muted"}
                      label={daysUntil <= 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil}d`}
                      className="shrink-0"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
