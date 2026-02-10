import { useParams, Link } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortalTripDetail } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function PortalTripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const { data, isLoading } = usePortalTripDetail(tripId || "");

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </PortalLayout>
    );
  }

  if (!data?.trip) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Trip not found</p>
          <Link to="/portal/trips" className="text-primary hover:underline text-sm mt-2 inline-block">
            ← Back to trips
          </Link>
        </div>
      </PortalLayout>
    );
  }

  const { trip, bookings, payments } = data;
  const totalPaid = payments?.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;
  const totalDue = payments?.filter((p: any) => p.status === "pending").reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;

  return (
    <PortalLayout>
      <div className="space-y-6">
        <Link to="/portal/trips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to trips
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{trip.trip_name}</h1>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              {trip.destination && (
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{trip.destination}</span>
              )}
              {trip.depart_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(trip.depart_date), "MMM d")}
                  {trip.return_date && ` – ${format(new Date(trip.return_date), "MMM d, yyyy")}`}
                </span>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">{trip.status}</Badge>
        </div>

        {/* Financials */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Trip Total</p>
              <p className="text-2xl font-bold text-foreground">${Number(trip.total_gross_sales).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <p className="text-2xl font-bold text-green-600">${totalPaid.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Balance Due</p>
              <p className="text-2xl font-bold text-orange-600">${totalDue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Bookings */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Items</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings?.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No booking items yet</p>
            ) : (
              <div className="space-y-3">
                {bookings?.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">{b.trip_name || b.destination}</p>
                      <p className="text-sm text-muted-foreground">
                        Ref: {b.booking_reference} · {b.travelers} traveler{b.travelers > 1 ? "s" : ""}
                      </p>
                      {b.depart_date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(b.depart_date), "MMM d")}
                          {b.return_date && ` – ${format(new Date(b.return_date), "MMM d, yyyy")}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${Number(b.total_amount).toLocaleString()}</p>
                      <Badge variant="outline" className="text-xs">{b.status}</Badge>
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
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payments?.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No payments recorded</p>
            ) : (
              <div className="space-y-3">
                {payments?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">${Number(p.amount).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.details || p.payment_type}
                        {p.payment_date && ` · ${format(new Date(p.payment_date), "MMM d, yyyy")}`}
                      </p>
                    </div>
                    <Badge variant={p.status === "paid" ? "default" : "outline"}>
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
