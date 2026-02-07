import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentBookings } from "@/components/dashboard/RecentBookings";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { CommissionSummary } from "@/components/dashboard/CommissionSummary";
import { TrainingProgress } from "@/components/dashboard/TrainingProgress";
import { Calendar, Users, DollarSign, TrendingUp } from "lucide-react";

const Index = () => {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground tracking-tight">
          Welcome back, Jane
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what's happening with your travel business today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Bookings"
          value="24"
          change="+3 this week"
          changeType="positive"
          icon={Calendar}
          iconBg="primary"
        />
        <StatCard
          title="Total Clients"
          value="156"
          change="+12 this month"
          changeType="positive"
          icon={Users}
          iconBg="accent"
        />
        <StatCard
          title="Monthly Revenue"
          value="$48,520"
          change="+18.2% vs last month"
          changeType="positive"
          icon={DollarSign}
          iconBg="success"
        />
        <StatCard
          title="Commission Rate"
          value="12.5%"
          change="Top performer"
          changeType="neutral"
          icon={TrendingUp}
          iconBg="primary"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Bookings */}
        <div className="lg:col-span-2 space-y-6">
          <RecentBookings />
        </div>

        {/* Right Column - Widgets */}
        <div className="space-y-6">
          <QuickActions />
          <CommissionSummary />
          <TrainingProgress />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
