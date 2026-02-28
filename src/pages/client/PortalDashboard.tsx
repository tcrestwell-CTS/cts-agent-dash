import { useState } from "react";
import { usePortalDashboard } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgencyCertifications } from "@/components/shared/AgencyCertifications";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, CreditCard, MessageSquare, User, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEffect } from "react";
import { DepartureCountdown } from "@/components/client/DepartureCountdown";
import { supabase } from "@/integrations/supabase/client";

interface PortalTrip {
  id: string;
  trip_name: string;
  destination: string | null;
  depart_date: string | null;
  return_date: string | null;
  cover_image_url: string | null;
  status: string;
}

interface PortalPayment {
  id: string;
  amount: number;
  payment_type: string;
  due_date: string | null;
  status: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

export default function PortalDashboard() {
  const { data, isLoading, isError, refetch } = usePortalDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") {
      toast.success("Payment completed successfully!");
      const sessionId = searchParams.get("session_id");
      if (sessionId) {
        supabase.functions.invoke("verify-stripe-payment", {
          body: { sessionId },
        }).then(() => refetch());
      } else {
        refetch();
      }
      // Clear payment params to prevent re-triggering on refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("payment");
      newParams.delete("session_id");
      setSearchParams(newParams, { replace: true });
    } else if (paymentStatus === "cancelled") {
      toast.info("Payment was cancelled");
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("payment");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, refetch, setSearchParams]);

  const handlePayNow = async (paymentId: string) => {
    setPayingId(paymentId);
    try {
      let portalToken: string | null = null;
      try {
        const raw = localStorage.getItem("portal_session");
        if (raw) portalToken = JSON.parse(raw).token;
      } catch {
        portalToken = null;
      }

      const { data, error } = await supabase.functions.invoke("create-stripe-payment", {
        body: { paymentId, returnUrl: window.location.origin },
        headers: { "x-portal-token": portalToken || "" },
      });

      if (error) throw new Error(error.message || "Failed to create payment");

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to start payment. Please try again.");
    } finally {
      setPayingId(null);
    }
  };

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

  if (isError || (!isLoading && !data)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
        <p className="text-muted-foreground text-center max-w-md">
          We couldn't load your dashboard. Please check your connection and try again.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const client = data?.client;
  const trips: PortalTrip[] = data?.trips || [];
  const payments: PortalPayment[] = data?.upcoming_payments || [];
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

        <Link to="/client/messages">
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
              {trips.slice(0, 5).map((trip: PortalTrip) => (
                <Link
                  key={trip.id}
                  to={`/client/trips/${trip.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  {trip.cover_image_url ? (
                    <img
                      src={trip.cover_image_url}
                      alt={trip.trip_name}
                      className="h-16 w-24 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-24 rounded-md bg-gradient-to-br from-primary/10 to-muted shrink-0 flex items-center justify-center">
                      <Map className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{trip.trip_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {trip.destination}
                      {trip.depart_date && ` · ${format(new Date(trip.depart_date), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <DepartureCountdown departDate={trip.depart_date} returnDate={trip.return_date} compact />
                    <Badge variant={trip.status === "confirmed" ? "default" : "secondary"}>
                      {trip.status}
                    </Badge>
                  </div>
                </Link>
              ))}
              {trips.length > 5 && (
                <Link to="/client/trips" className="text-sm text-primary hover:underline mt-2 block">
                  View all {trips.length} trips →
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
              <AgencyCertifications
                cliaNumber={agent.clia_number}
                ccraNumber={agent.ccra_number}
                astaNumber={agent.asta_number}
                embarcNumber={agent.embarc_number}
                compact
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Payments */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map((p: PortalPayment) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">
                      {p.payment_type === "final_balance" ? "Final Balance" : 
                       p.payment_type.charAt(0).toUpperCase() + p.payment_type.slice(1)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {p.due_date ? `Due ${format(new Date(p.due_date), "MMM d, yyyy")}` : "Pending"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{formatCurrency(p.amount)}</p>
                    <Button
                      size="sm"
                      onClick={() => handlePayNow(p.id)}
                      disabled={payingId === p.id}
                    >
                      {payingId === p.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-1" />
                      )}
                      Pay Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
