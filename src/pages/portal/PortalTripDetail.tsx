import { useParams, Link } from "react-router-dom";
import { usePortalTripDetail } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Calendar, Plane, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function PortalTripDetail() {
  const { tripId } = useParams();
  const { data, isLoading } = usePortalTripDetail(tripId);

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

  const { trip, bookings = [], payments = [] } = data;

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
