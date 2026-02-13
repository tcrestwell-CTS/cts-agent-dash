import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Calendar, Clock, ClipboardList, Plane } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";

const categoryIcons: Record<string, string> = {
  flight: "✈️", hotel: "🏨", cruise: "🚢", transportation: "🚗",
  activity: "🎯", dining: "🍽️", sightseeing: "📸", relaxation: "💆",
  shopping: "🛍️", entertainment: "🎵", meeting: "📋", other: "📌",
};

interface SharedTripData {
  trip: {
    trip_name: string;
    destination: string | null;
    depart_date: string | null;
    return_date: string | null;
    status: string;
    trip_type: string | null;
    notes: string | null;
  };
  itinerary: any[];
  bookings: any[];
  branding: {
    agency_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
    tagline: string | null;
  } | null;
}

export default function SharedTrip() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shared-trip?token=${token}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        if (!res.ok) {
          setError(res.status === 404 ? "This trip page is not available." : "Something went wrong.");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Unable to load trip.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">{error || "Trip not found."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { trip, itinerary, branding } = data;

  const dayGroups: Record<number, any[]> = {};
  for (const item of itinerary) {
    if (!dayGroups[item.day_number]) dayGroups[item.day_number] = [];
    dayGroups[item.day_number].push(item);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with branding */}
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          {branding?.logo_url && (
            <img src={branding.logo_url} alt="" className="h-8 w-auto" />
          )}
          <span className="text-sm font-medium text-muted-foreground">
            {branding?.agency_name || "Travel Itinerary"}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Trip Header */}
        <div>
          <h1 className="text-3xl font-bold">{trip.trip_name}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
            {trip.destination && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {trip.destination}
              </span>
            )}
            {trip.depart_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(parseISO(trip.depart_date), "MMM d, yyyy")}
                {trip.return_date && ` — ${format(parseISO(trip.return_date), "MMM d, yyyy")}`}
              </span>
            )}
            {trip.trip_type && (
              <Badge variant="secondary">
                {trip.trip_type.charAt(0).toUpperCase() + trip.trip_type.slice(1).replace("_", " ")}
              </Badge>
            )}
          </div>
        </div>

        {/* Notes */}
        {trip.notes && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{trip.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Itinerary */}
        {itinerary.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Itinerary
            </h2>
            {Object.entries(dayGroups)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([day, items]) => {
                const dateStr = trip.depart_date
                  ? format(addDays(parseISO(trip.depart_date), Number(day) - 1), "EEEE, MMM d")
                  : null;
                return (
                  <Card key={day}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                          {day}
                        </span>
                        Day {day}
                        {dateStr && <span className="text-muted-foreground font-normal text-sm">— {dateStr}</span>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {items.map((item: any) => (
                          <div key={item.id} className="flex gap-3">
                            <span className="text-lg mt-0.5">{categoryIcons[item.category] || "📌"}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{item.title}</p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                              )}
                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                {item.start_time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {item.start_time.slice(0, 5)}
                                    {item.end_time && ` – ${item.end_time.slice(0, 5)}`}
                                  </span>
                                )}
                                {item.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> {item.location}
                                  </span>
                                )}
                              </div>
                              {item.notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No itinerary items published yet.</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-8 pb-4 border-t">
          {branding?.agency_name && <p>Prepared by {branding.agency_name}</p>}
          {branding?.tagline && <p className="mt-1">{branding.tagline}</p>}
        </div>
      </div>
    </div>
  );
}
