import { usePortalTrips } from "@/hooks/usePortalData";
import { AgentTripDocumentsView } from "@/components/client/AgentTripDocumentsView";
import { usePortalAgentDocs } from "@/hooks/usePortalData";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen } from "lucide-react";

export default function PortalDocuments() {
  const { data, isLoading } = usePortalTrips();
  const trips = data?.trips || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" />
          Documents
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Travel documents your agent has shared with you, grouped by trip.
        </p>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No trips yet — documents will appear here once your agent shares them.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {trips.map((trip: any) => (
            <TripDocsSection key={trip.id} tripId={trip.id} tripName={trip.trip_name} />
          ))}
        </div>
      )}
    </div>
  );
}

function TripDocsSection({ tripId, tripName }: { tripId: string; tripName: string }) {
  const { data } = usePortalAgentDocs(tripId);
  const docs = data?.docs || [];
  if (docs.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {tripName}
      </h2>
      <AgentTripDocumentsView tripId={tripId} />
    </div>
  );
}