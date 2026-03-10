import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AgencyMetrics } from "@/components/dashboard/AgencyMetrics";
import { OnboardingWizard } from "@/components/dashboard/OnboardingWizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Plus,
  Send,
  UserPlus,
  Phone,
  CreditCard,
  Plane,
  ArrowRight,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  FileText,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBookings, isBookingArchived } from "@/hooks/useBookings";
import { useClients } from "@/hooks/useClients";
import { useTrips } from "@/hooks/useTrips";
import { useCanViewTeam } from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";
import {
  format,
  addDays,
  isFuture,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  parseISO,
  isPast,
} from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"my" | "agency">("my");
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";
  const { canView: canViewAgencyMetrics } = useCanViewTeam();

  const { bookings, loading: bookingsLoading } = useBookings();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { trips, loading: tripsLoading } = useTrips();

  // Pending payments for "Payments Due" counter
  const { data: pendingPayments } = useQuery({
    queryKey: ["dashboard-pending-payments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_payments")
        .select("id, due_date, status")
        .eq("status", "pending")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Recent activity from bookings
  const { data: recentActivity } = useQuery({
    queryKey: ["dashboard-recent-activity", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_reference, status, created_at, updated_at, trip_name, destination, clients(name)")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const loading = bookingsLoading || clientsLoading || tripsLoading;

  const computed = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sevenDays = addDays(now, 7);
    const thirtyDays = addDays(now, 30);
    const thisMonth = { start: startOfMonth(now), end: endOfMonth(now) };

    const activeBookings = (bookings || []).filter((b) => !isBookingArchived(b));

    // TODAY counters
    // Follow Ups: proposals sent > 3 days ago
    const followUps = (trips || []).filter((t) => {
      if (t.status !== "proposal_sent" || !t.proposal_sent_at) return false;
      return differenceInDays(now, parseISO(t.proposal_sent_at)) > 3;
    }).length;

    // Payments Due within 7 days
    const paymentsDue = (pendingPayments || []).filter((p) => {
      if (!p.due_date) return false;
      const d = parseISO(p.due_date);
      return isPast(d) || isWithinInterval(d, { start: now, end: sevenDays });
    }).length;

    // Departures within 14 days
    const departuresSoon = (trips || []).filter((t) => {
      if (!t.depart_date || t.status === "cancelled") return false;
      const d = new Date(t.depart_date);
      return isFuture(d) && isWithinInterval(d, { start: now, end: addDays(now, 14) });
    }).length;

    // SALES PIPELINE
    const quotesSent = (trips || []).filter((t) => t.status === "proposal_sent").length;
    const pendingBookingsCount = activeBookings.filter((b) => b.status === "pending").length;
    const confirmedTrips = (trips || []).filter((t) => t.status === "booked" || t.status === "confirmed").length;

    // UPCOMING TRIPS
    const upcomingTrips = (trips || [])
      .filter((t) => {
        if (!t.depart_date || t.status === "cancelled" || t.status === "archived") return false;
        const d = new Date(t.depart_date);
        return isFuture(d) && isWithinInterval(d, { start: now, end: thirtyDays });
      })
      .sort((a, b) => new Date(a.depart_date!).getTime() - new Date(b.depart_date!).getTime())
      .slice(0, 5);

    // BUSINESS SNAPSHOT
    const thisMonthBookings = activeBookings.filter((b) => {
      const d = new Date(b.created_at);
      return isWithinInterval(d, thisMonth) && b.status !== "cancelled";
    });
    const revenueMTD = thisMonthBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const totalClients = (clients || []).length;
    const clientsWithBookings = new Set(activeBookings.map((b) => b.client_id)).size;
    const conversionRate = totalClients > 0 ? Math.round((clientsWithBookings / totalClients) * 100) : 0;

    return {
      followUps,
      paymentsDue,
      departuresSoon,
      quotesSent,
      pendingBookingsCount,
      confirmedTrips,
      upcomingTrips,
      revenueMTD,
      totalClients,
      conversionRate,
    };
  }, [bookings, clients, trips, pendingPayments]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

  // Search navigation
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    navigate(`/contacts?search=${encodeURIComponent(searchQuery)}`);
  };

  // Activity item description
  const getActivityLabel = (item: any) => {
    const clientName = item.clients?.name || "Client";
    switch (item.status) {
      case "confirmed":
        return { icon: CheckCircle2, text: `Booking Confirmed → ${clientName}`, color: "text-success" };
      case "pending":
        return { icon: Send, text: `Quote Sent → ${clientName}`, color: "text-accent" };
      default:
        return { icon: FileText, text: `${item.status} → ${clientName}`, color: "text-muted-foreground" };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {firstName}
          </h1>
        </div>

        {/* Top Bar: Search + Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients, trips, bookings..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={() => navigate("/trips?action=new")}>
              <Plus className="h-4 w-4 mr-1" />
              New Trip
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/contacts")}>
              <Send className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Send Quote</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/contacts?action=new")}>
              <UserPlus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Add Client</span>
            </Button>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("my")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "my"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              My Dashboard
            </button>
            {canViewAgencyMetrics && (
              <button
                onClick={() => setActiveTab("agency")}
                className={cn(
                  "pb-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "agency"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Agency Metrics
              </button>
            )}
          </div>
        </div>

        {activeTab === "agency" ? (
          <AgencyMetrics />
        ) : (
          <>
            <OnboardingWizard />

            {/* TODAY section */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Today</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CounterCard
                  label="Follow Ups"
                  count={loading ? null : computed.followUps}
                  icon={Phone}
                  onClick={() => navigate("/trips")}
                  urgent={computed.followUps > 0}
                />
                <CounterCard
                  label="Payments Due"
                  count={loading ? null : computed.paymentsDue}
                  icon={CreditCard}
                  onClick={() => navigate("/trips")}
                  urgent={computed.paymentsDue > 0}
                />
                <CounterCard
                  label="Departures Soon"
                  count={loading ? null : computed.departuresSoon}
                  icon={Plane}
                  onClick={() => navigate("/trips")}
                  urgent={computed.departuresSoon >= 3}
                />
              </div>
            </div>

            {/* SALES PIPELINE */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sales Pipeline</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CounterCard
                  label="Quotes Sent"
                  count={loading ? null : computed.quotesSent}
                  icon={Send}
                  onClick={() => navigate("/trips")}
                />
                <CounterCard
                  label="Pending Bookings"
                  count={loading ? null : computed.pendingBookingsCount}
                  icon={Calendar}
                  onClick={() => navigate("/bookings")}
                />
                <CounterCard
                  label="Confirmed Trips"
                  count={loading ? null : computed.confirmedTrips}
                  icon={CheckCircle2}
                  onClick={() => navigate("/trips")}
                />
              </div>
            </div>

            {/* Two-column: Upcoming Trips + Right sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* UPCOMING TRIPS */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Upcoming Trips
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/trips")} className="text-xs">
                      View All <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : computed.upcomingTrips.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No upcoming trips</p>
                  ) : (
                    <div className="space-y-2">
                      {computed.upcomingTrips.map((trip) => {
                        const daysUntil = differenceInDays(new Date(trip.depart_date!), new Date());
                        return (
                          <div
                            key={trip.id}
                            onClick={() => navigate(`/trips/${trip.id}`)}
                            className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <MapPin className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {trip.clients?.name || "Client"} – {trip.trip_name || trip.destination}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Departure: {format(new Date(trip.depart_date!), "MMM d")}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "shrink-0 text-xs",
                                daysUntil <= 7 && "bg-destructive/10 text-destructive"
                              )}
                            >
                              {daysUntil <= 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Right column: Recent Activity + Business Snapshot */}
              <div className="space-y-6">
                {/* RECENT ACTIVITY */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!recentActivity || recentActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
                    ) : (
                      <div className="space-y-3">
                        {recentActivity.map((item) => {
                          const activity = getActivityLabel(item);
                          const Icon = activity.icon;
                          return (
                            <div key={item.id} className="flex items-center gap-3">
                              <Icon className={cn("h-4 w-4 shrink-0", activity.color)} />
                              <p className="text-sm text-foreground truncate">{activity.text}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* BUSINESS SNAPSHOT */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Business Snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          Revenue (MTD)
                        </div>
                        <span className="text-lg font-semibold text-foreground">
                          {loading ? "..." : formatCurrency(computed.revenueMTD)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          Clients
                        </div>
                        <span className="text-lg font-semibold text-foreground">
                          {loading ? "..." : computed.totalClients}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          Conversion
                        </div>
                        <span className="text-lg font-semibold text-foreground">
                          {loading ? "..." : `${computed.conversionRate}%`}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

/* ─── Counter Card ─── */
function CounterCard({
  label,
  count,
  icon: Icon,
  onClick,
  urgent,
}: {
  label: string;
  count: number | null;
  icon: React.ElementType;
  onClick?: () => void;
  urgent?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50",
        urgent
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card"
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          urgent ? "bg-destructive/10" : "bg-primary/10"
        )}
      >
        <Icon className={cn("h-5 w-5", urgent ? "text-destructive" : "text-primary")} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground leading-none">
          {count === null ? <Skeleton className="h-7 w-8 inline-block" /> : count}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

export default Index;
