import { usePortalDashboard } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, CreditCard, MessageSquare, User } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function PortalDashboard() {
  const { data, isLoading } = usePortalDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const client = data?.client;
  const trips = data?.trips || [];
  const payments = data?.upcoming_payments || [];
  const agent = data?.agent;
  const unreadMessages = data?.unread_messages || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {client?.first_name || client?.name || "Traveler"}
        </h1>
        <p className="text-muted-foreground">Here's an overview of your travel plans</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Map className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{trips.length}</p>
              <p className="text-sm text-muted-foreground">Active Trips</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{payments.length}</p>
              <p className="text-sm text-muted-foreground">Pending Payments</p>
            </div>
          </CardContent>
        </Card>

        <Link to="/portal/messages">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadMessages}</p>
                <p className="text-sm text-muted-foreground">Unread Messages</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Agent Card */}
      {agent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Your Travel Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            {agent.avatar_url ? (
              <img src={agent.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <p className="font-semibold">{agent.full_name}</p>
              {agent.job_title && <p className="text-sm text-muted-foreground">{agent.job_title}</p>}
              {agent.phone && <p className="text-sm text-muted-foreground">{agent.phone}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Trips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming Trips</CardTitle>
        </CardHeader>
        <CardContent>
          {trips.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active trips yet.</p>
          ) : (
            <div className="space-y-3">
              {trips.slice(0, 5).map((trip: any) => (
                <Link
                  key={trip.id}
                  to={`/portal/trips/${trip.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{trip.trip_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {trip.destination}
                      {trip.depart_date && ` · ${format(new Date(trip.depart_date), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <Badge variant={trip.status === "confirmed" ? "default" : "secondary"}>
                    {trip.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Payments */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{p.payment_type}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.due_date ? `Due ${format(new Date(p.due_date), "MMM d, yyyy")}` : "Pending"}
                    </p>
                  </div>
                  <p className="font-semibold">${p.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
