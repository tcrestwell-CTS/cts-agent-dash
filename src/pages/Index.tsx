import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentBookings } from "@/components/dashboard/RecentBookings";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { CommissionSummary } from "@/components/dashboard/CommissionSummary";
import { TrainingProgress } from "@/components/dashboard/TrainingProgress";
import { UpcomingDepartures } from "@/components/dashboard/UpcomingDepartures";
import { MonthlyRevenueChart } from "@/components/dashboard/MonthlyRevenueChart";
import { AgencyKPIs } from "@/components/dashboard/AgencyKPIs";
import { AgentLeaderboard } from "@/components/dashboard/AgentLeaderboard";
import { CommissionRevenueCard } from "@/components/dashboard/CommissionRevenueCard";
import { UpcomingCommissions } from "@/components/dashboard/UpcomingCommissions";
import { UpcomingPayments } from "@/components/dashboard/UpcomingPayments";
import { InvoiceSearch } from "@/components/dashboard/InvoiceSearch";
import { AgencyMetrics } from "@/components/dashboard/AgencyMetrics";
import { Calendar, Users, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/layout/PageBanner";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCanViewTeam } from "@/hooks/useAdmin";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"my" | "agency">("my");
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const { sections, stats, loading, isAgencyView } = useDashboardData();
  const { canView: canViewAgencyMetrics } = useCanViewTeam();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Determine which sections should be full-width based on urgency/data count
  const departuresFullWidth = sections.upcomingDepartures.urgentCount >= 3 || sections.upcomingDepartures.dataCount >= 4;
  const commissionsFullWidth = sections.upcomingCommissions.urgentCount >= 3 || sections.upcomingCommissions.dataCount >= 4;
  const paymentsUrgent = (sections.upcomingPayments as any).overdueCount > 0 || sections.upcomingPayments.urgentCount > 0;
  
  // Sections with urgent items appear in a highlighted priority row
  const hasUrgentItems = sections.upcomingDepartures.urgentCount > 0 || sections.upcomingCommissions.urgentCount > 0 || paymentsUrgent;

  return (
    <DashboardLayout>
      <PageBanner
        title={`Welcome back, ${firstName}`}
        subtitle="Here's what's happening with your travel business today."
      />

      {/* Dashboard Tabs */}
      <div className="mb-8 border-b border-border">
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

      {/* Stats Grid - Always visible with minimal loading states */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Bookings"
          value={loading ? "..." : stats.activeBookings.toString()}
          change={`${stats.confirmedBookings} confirmed, ${stats.pendingBookings} pending`}
          changeType="positive"
          icon={Calendar}
          iconBg="primary"
        />
        <StatCard
          title="Total Clients"
          value={loading ? "..." : stats.totalClients.toString()}
          change="In your database"
          changeType="neutral"
          icon={Users}
          iconBg="accent"
        />
        <StatCard
          title="Total Revenue"
          value={loading ? "..." : formatCurrency(stats.totalRevenue)}
          change={`From ${stats.confirmedBookings + stats.completedBookings} bookings`}
          changeType="positive"
          icon={DollarSign}
          iconBg="success"
        />
        <StatCard
          title="Completed Trips"
          value={loading ? "..." : stats.completedBookings.toString()}
          change="Successfully delivered"
          changeType="neutral"
          icon={TrendingUp}
          iconBg="primary"
        />
      </div>

      {/* Priority Urgent Row - Only shown when there are urgent items */}
      {hasUrgentItems && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Needs Attention
          </h2>
          <div className={cn(
            "grid gap-6",
            [sections.upcomingDepartures.urgentCount > 0, sections.upcomingCommissions.urgentCount > 0, paymentsUrgent].filter(Boolean).length >= 2
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1"
          )}>
            {paymentsUrgent && (
              <div className="ring-2 ring-destructive/30 rounded-xl">
                <UpcomingPayments />
              </div>
            )}
            {sections.upcomingDepartures.urgentCount > 0 && (
              <div className="ring-2 ring-destructive/30 rounded-xl">
                <UpcomingDepartures />
              </div>
            )}
            {sections.upcomingCommissions.urgentCount > 0 && (
              <div className="ring-2 ring-destructive/30 rounded-xl">
                <UpcomingCommissions />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Grid - Reactive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Primary Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPIs - Always prominent */}
          <AgencyKPIs />
          
          {/* Monthly Chart - Resize based on data */}
          {sections.kpis.hasData && <MonthlyRevenueChart />}
          
          {/* Recent Bookings - Conditional sizing */}
          {sections.recentBookings.hasData ? (
            <RecentBookings />
          ) : (
            <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 opacity-60">
              <h3 className="text-sm font-medium text-muted-foreground">Upcoming Trips</h3>
              <p className="text-xs text-muted-foreground mt-1">No upcoming bookings</p>
            </div>
          )}
        </div>

        {/* Right Column - Widgets */}
        <div className="space-y-6">
          <QuickActions />
          
          {/* Invoice Search */}
          <InvoiceSearch />
          
          {/* Commission Revenue - Always show */}
          <CommissionRevenueCard />

          {/* Upcoming Payments - Skip if shown in urgent row */}
          {!hasUrgentItems || !paymentsUrgent ? (
            sections.upcomingPayments.hasData ? (
              <UpcomingPayments />
            ) : (
              <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 opacity-60">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Upcoming Payments
                </h3>
                <p className="text-xs text-muted-foreground mt-1">No payments due soon</p>
              </div>
            )
          ) : null}
          
          {/* Upcoming Commissions - Skip if shown in urgent row */}
          {!hasUrgentItems || sections.upcomingCommissions.urgentCount === 0 ? (
            sections.upcomingCommissions.hasData ? (
              <UpcomingCommissions />
            ) : (
              <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 opacity-60">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Upcoming Commissions
                </h3>
                <p className="text-xs text-muted-foreground mt-1">No commissions expected soon</p>
              </div>
            )
          ) : null}
          
          {/* Agent Leaderboard - Only for admins with data */}
          {isAgencyView && sections.leaderboard.hasData && <AgentLeaderboard />}
          
          {/* Upcoming Departures - Skip if shown in urgent row */}
          {!hasUrgentItems || sections.upcomingDepartures.urgentCount === 0 ? (
            sections.upcomingDepartures.hasData ? (
              <UpcomingDepartures />
            ) : (
              <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 opacity-60">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming Departures
                </h3>
                <p className="text-xs text-muted-foreground mt-1">No departures in the next 30 days</p>
              </div>
            )
          ) : null}
          
          {/* Commission Summary - Conditional visibility */}
          {sections.commissionSummary.hasData && <CommissionSummary />}
          
          {/* Training - Static for now, could be data-driven later */}
          <TrainingProgress />
        </div>
      </div>
      </>
      )}
    </DashboardLayout>
  );
};

export default Index;
