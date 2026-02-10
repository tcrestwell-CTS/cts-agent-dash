import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortalDashboard } from "@/hooks/usePortalData";
import { usePortal } from "@/contexts/PortalContext";
import { portalRoutes } from "@/lib/portalRoutes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass, DollarSign, MessageCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function PortalDashboard() {
  const { session } = usePortal();
  const { data, isLoading } = usePortalDashboard();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "traveling": return "bg-green-100 text-green-800";
      case "booked": return "bg-blue-100 text-blue-800";
      case "planning": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-gray-100 text-gray-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </PortalLayout>
    );
  }

  const trips = data?.trips || [];
  const upcomingPayments = data?.upcoming_payments || [];
  const unreadMessages = data?.unread_messages || 0;

  return (
    <PortalLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {session?.clientName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's an overview of your travel activity
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Compass className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{trips.length}</p>
                <p className="text-sm text-muted-foreground">Active Trips</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingPayments.length}</p>
                <p className="text-sm text-muted-foreground">Pending Payments</p>
              </div>
            </CardContent>
          </Card>
          <Link to={portalRoutes.messages}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{unreadMessages}</p>
                  <p className="text-sm text-muted-foreground">Unread Messages</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Upcoming trips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Your Trips
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trips.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No active trips yet. Your travel agent will add trips here.
              </p>
            ) : (
              <div className="space-y-3">
                {trips.slice(0, 5).map((trip: any) => (
                  <Link
                    key={trip.id}
                    to={portalRoutes.tripDetail(trip.id)}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">{trip.trip_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {trip.destination || "Destination TBD"}
                        {trip.depart_date && ` · ${format(new Date(trip.depart_date), "MMM d, yyyy")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(trip.status)} variant="secondary">
                        {trip.status}
                      </Badge>
                      {trip.total_gross_sales > 0 && (
                        <span className="text-sm font-medium text-foreground">
                          ${Number(trip.total_gross_sales).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
                {trips.length > 5 && (
                  <Link to={portalRoutes.trips} className="text-primary text-sm hover:underline block text-center pt-2">
                    View all {trips.length} trips →
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming payments */}
        {upcomingPayments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Upcoming Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingPayments.map((payment: any) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium text-foreground">
                        ${Number(payment.amount).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.due_date
                          ? `Due ${format(new Date(payment.due_date), "MMM d, yyyy")}`
                          : "Due date TBD"}
                      </p>
                    </div>
                    <Badge variant="outline">{payment.payment_type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
