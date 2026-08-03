import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrips } from "@/hooks/useTrips";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Compass, ArrowRight } from "lucide-react";

/**
 * Entry point for the "Trip Builder" nav item.
 * TripDetail owns the itinerary workspace but needs a :tripId, so this page
 * lets the agent pick which trip to build instead of auto-locking onto one.
 */
const TripBuilderEntry = () => {
  const navigate = useNavigate();
  const { trips, loading: isLoading } = useTrips();
  const [query, setQuery] = useState("");

  const openStatuses = ["draft", "quoted", "proposal_sent", "booked", "confirmed"];

  const sorted = useMemo(() => {
    const list = [...(trips ?? [])].sort(
      (a, b) =>
        new Date(b.updated_at ?? b.created_at).getTime() -
        new Date(a.updated_at ?? a.created_at).getTime()
    );
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (t) =>
            t.trip_name?.toLowerCase().includes(q) ||
            (t.destination || "").toLowerCase().includes(q) ||
            ((t as any).clients?.name || "").toLowerCase().includes(q)
        )
      : list;
    return filtered;
  }, [trips, query]);

  const open = sorted.filter((t) => openStatuses.includes(t.status));
  const visible = (open.length > 0 ? open : sorted).slice(0, 24);

  const go = (id: string) => navigate(`/trips/${id}/itinerary`);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Trip Builder
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose a trip to build its itinerary.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/trips")}>
            All trips
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by trip, client, or destination..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : visible.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No trips found.</p>
            <Button onClick={() => navigate("/trips")}>Go to Trips</Button>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((t) => (
              <Card
                key={t.id}
                onClick={() => go(t.id)}
                className="p-4 cursor-pointer hover:border-primary/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.trip_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(t as any).clients?.name || "No client"}
                      {t.destination ? ` · ${t.destination}` : ""}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {t.status?.replace(/_/g, " ")}
                  </Badge>
                  {t.depart_date && (
                    <span className="text-[11px] text-muted-foreground">
                      {t.depart_date}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TripBuilderEntry;
