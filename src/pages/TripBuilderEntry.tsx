import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTrips } from "@/hooks/useTrips";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Entry point for the "Trip Builder" nav item.
 * TripDetail already owns the itinerary/details/bookings workspace and its
 * own trip switcher, but it requires a :tripId in the URL. This page picks
 * the agent's most recently active trip and redirects into that workspace.
 */
const TripBuilderEntry = () => {
  const navigate = useNavigate();
  const { trips, isLoading } = useTrips();

  useEffect(() => {
    if (isLoading || !trips) return;

    if (trips.length === 0) {
      navigate("/trips", { replace: true });
      return;
    }

    // Prefer the most recently updated trip that isn't closed/cancelled;
    // fall back to the most recently updated trip of any status.
    const openStatuses = ["draft", "quoted", "proposal_sent", "booked", "confirmed"];
    const sorted = [...trips].sort(
      (a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()
    );
    const target = sorted.find((t) => openStatuses.includes(t.status)) ?? sorted[0];

    navigate(`/trips/${target.id}/itinerary`, { replace: true });
  }, [isLoading, trips, navigate]);

  return (
    <DashboardLayout>
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </DashboardLayout>
  );
};

export default TripBuilderEntry;
