import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentBookings } from "@/components/dashboard/RecentBookings";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { CommissionSummary } from "@/components/dashboard/CommissionSummary";
import { TrainingProgress } from "@/components/dashboard/TrainingProgress";
import { UpcomingDepartures } from "@/components/dashboard/UpcomingDepartures";
import { MonthlyRevenueChart } from "@/components/dashboard/MonthlyRevenueChart";
import { Calendar, Users, DollarSign, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  activeBookings: number;
  totalClients: number;
  totalRevenue: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
}

const Index = () => {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const [stats, setStats] = useState<DashboardStats>({
    activeBookings: 0,
    totalClients: 0,
    totalRevenue: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    completedBookings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      // Fetch bookings stats
      const { data: bookings } = await supabase
        .from("bookings")
        .select("status, total_amount");

      const activeBookings = bookings?.filter(
        (b) => b.status === "confirmed" || b.status === "pending"
      ).length || 0;
      const pendingBookings = bookings?.filter((b) => b.status === "pending").length || 0;
      const confirmedBookings = bookings?.filter((b) => b.status === "confirmed").length || 0;
      const completedBookings = bookings?.filter((b) => b.status === "completed").length || 0;
      const totalRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

      // Fetch clients count
      const { count: clientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });

      setStats({
        activeBookings,
        totalClients: clientsCount || 0,
        totalRevenue,
        pendingBookings,
        confirmedBookings,
        completedBookings,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what's happening with your travel business today.
        </p>
      </div>

      {/* Stats Grid */}
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Bookings & Charts */}
        <div className="lg:col-span-2 space-y-6">
          <MonthlyRevenueChart />
          <RecentBookings />
        </div>

        {/* Right Column - Widgets */}
        <div className="space-y-6">
          <QuickActions />
          <UpcomingDepartures />
          <CommissionSummary />
          <TrainingProgress />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
