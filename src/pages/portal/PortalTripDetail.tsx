import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { usePortalTripDetail } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Calendar, Plane, CreditCard, ClipboardList, Clock, MapPinned, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

const categoryIcons: Record<string, string> = {
  flight: "✈️", lodging: "🏨", cruise: "🚢", transportation: "🚗",
  activity: "🎯", dining: "🍽️", meeting: "📋", other: "📌",
};

export default function PortalTripDetail() {
  const { tripId } = useParams();
  const { data, isLoading } = usePortalTripDetail(tripId);
  const [showItinerary, setShowItinerary] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!data?.trip) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Trip not found.</p>
        <Link to="/portal/trips">
          <Button variant="outline" className="mt-4">Back to Trips</Button>
        </Link>
      </div>
    );
  }

  const { trip, bookings = [], payments = [], itinerary = [] } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/portal/trips">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{trip.trip_name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            {trip.destination && (
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {trip.destination}</span>
            )}
            {trip.depart_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(trip.depart_date), "MMM d")}
                {trip.return_date && ` – ${format(new Date(trip.return_date), "MMM d, yyyy")}`}
              </span>
            )}
          </div>
        </div>
        <Badge className="ml-auto" variant={trip.status === "confirmed" ? "default" : "secondary"}>
          {trip.status}
        </Badge>
      </div>

      {/* Bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plane className="h-4 w-4" /> Bookings ({bookings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <div className="space-y-3">
              {bookings.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{b.trip_name || b.booking_reference}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.destination}
                      {b.depart_date && ` · ${format(new Date(b.depart_date), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={b.status === "confirmed" ? "default" : "secondary"} className="mb-1">
                      {b.status}
                    </Badge>
                    {b.total_amount > 0 && (
                      <p className="text-sm font-medium">${b.total_amount.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Payments ({payments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{p.payment_type}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : format(new Date(p.payment_date), "MMM d, yyyy")}
                    </p>
                    {p.details && <p className="text-xs text-muted-foreground">{p.details}</p>}
                  </div>
                  <div className="text-right">
                    <Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge>
                    <p className="text-sm font-medium mt-1">${p.amount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Itinerary */}
      {itinerary.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setShowItinerary(!showItinerary)}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> View Full Itinerary ({itinerary.length} items)
              {showItinerary ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
            </CardTitle>
          </CardHeader>
          {showItinerary && (
            <CardContent>
              {Object.entries(
                itinerary.reduce((acc: Record<number, any[]>, item: any) => {
                  (acc[item.day_number] = acc[item.day_number] || []).push(item);
                  return acc;
                }, {})
              ).map(([day, items]: [string, any[]]) => (
                <div key={day} className="mb-5 last:mb-0">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Day {day}
                    {items[0]?.item_date && (
                      <span className="text-muted-foreground font-normal">
                        — {format(new Date(items[0].item_date), "EEEE, MMM d, yyyy")}
                      </span>
                    )}
                  </h4>
                  <div className="space-y-2 ml-5 border-l-2 border-muted pl-4">
                    {items.map((item: any) => (
                      <div key={item.id} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-start gap-2">
                          <span className="text-lg">{categoryIcons[item.category] || "📌"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.title}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                              {(item.start_time || item.end_time) && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {item.start_time}{item.end_time && ` – ${item.end_time}`}
                                </span>
                              )}
                              {item.location && (
                                <span className="flex items-center gap-1">
                                  <MapPinned className="h-3 w-3" /> {item.location}
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Notes */}
      {trip.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trip Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{trip.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
