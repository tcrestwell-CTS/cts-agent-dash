import { useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useBookings } from "@/hooks/useBookings";
import { useClients } from "@/hooks/useClients";
import { useCommissions } from "@/hooks/useCommissions";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  format,
  parseISO,
  startOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  isWithinInterval,
} from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Plane,
  DollarSign,
  Target,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
} from "lucide-react";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  description,
}: {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {change && (
              <div className="flex items-center gap-1">
                {changeType === "positive" && <TrendingUp className="h-4 w-4 text-green-500" />}
                {changeType === "negative" && <TrendingDown className="h-4 w-4 text-red-500" />}
                <span
                  className={`text-sm font-medium ${
                    changeType === "positive"
                      ? "text-green-500"
                      : changeType === "negative"
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {change}
                </span>
              </div>
            )}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Analytics = () => {
  const { bookings, loading: bookingsLoading } = useBookings();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: commissions, isLoading: commissionsLoading } = useCommissions();

  const loading = bookingsLoading || clientsLoading || commissionsLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Monthly revenue data for chart (based on depart_date)
  const monthlyRevenueData = useMemo(() => {
    if (!bookings?.length) return [];

    const months: { [key: string]: number } = {};
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthDate = startOfMonth(subMonths(now, i));
      const monthKey = format(monthDate, "yyyy-MM");
      months[monthKey] = 0;
    }

    bookings.forEach((booking) => {
      if (booking.status === "cancelled") return;
      const departDate = parseISO(booking.depart_date);
      const monthKey = format(departDate, "yyyy-MM");
      if (months[monthKey] !== undefined) {
        months[monthKey] += booking.total_amount || 0;
      }
    });

    return Object.entries(months).map(([month, revenue]) => ({
      month: format(parseISO(`${month}-01`), "MMM"),
      revenue,
    }));
  }, [bookings]);

  // Booking status distribution
  const bookingStatusData = useMemo(() => {
    if (!bookings?.length) return [];

    const statusCounts: { [key: string]: number } = {};
    bookings.forEach((booking) => {
      const status = booking.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [bookings]);

  // Top destinations
  const topDestinations = useMemo(() => {
    if (!bookings?.length) return [];

    const destinations: { [key: string]: { count: number; revenue: number } } = {};
    bookings.forEach((booking) => {
      if (booking.status === "cancelled") return;
      const dest = booking.destination || "Unknown";
      if (!destinations[dest]) {
        destinations[dest] = { count: 0, revenue: 0 };
      }
      destinations[dest].count += 1;
      destinations[dest].revenue += booking.total_amount || 0;
    });

    return Object.entries(destinations)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [bookings]);

  // Client acquisition over time
  const clientAcquisitionData = useMemo(() => {
    if (!clients?.length) return [];

    const months: { [key: string]: number } = {};
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthDate = startOfMonth(subMonths(now, i));
      const monthKey = format(monthDate, "yyyy-MM");
      months[monthKey] = 0;
    }

    clients.forEach((client) => {
      const created = parseISO(client.created_at);
      const monthKey = format(created, "yyyy-MM");
      if (months[monthKey] !== undefined) {
        months[monthKey] += 1;
      }
    });

    return Object.entries(months).map(([month, count]) => ({
      month: format(parseISO(`${month}-01`), "MMM"),
      clients: count,
    }));
  }, [clients]);

  // KPI calculations
  const kpis = useMemo(() => {
    if (!bookings || !clients || !commissions) return null;

    const now = new Date();
    const thisYear = { start: startOfYear(now), end: endOfYear(now) };

    // YTD metrics (based on depart_date)
    const ytdBookings = bookings.filter((b) => {
      const departDate = parseISO(b.depart_date);
      return isWithinInterval(departDate, thisYear) && b.status !== "cancelled";
    });

    const ytdRevenue = ytdBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const totalRevenue = bookings
      .filter((b) => b.status !== "cancelled")
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    // Average booking value
    const avgBookingValue =
      bookings.length > 0
        ? bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0) / bookings.length
        : 0;

    // Conversion rate
    const clientsWithBookings = new Set(bookings.map((b) => b.client_id)).size;
    const conversionRate = clients.length > 0 ? (clientsWithBookings / clients.length) * 100 : 0;

    // Commission metrics
    const totalPending = commissions
      .filter((c) => c.status === "pending")
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    const totalPaid = commissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    return {
      totalRevenue,
      ytdRevenue,
      totalBookings: bookings.length,
      ytdBookings: ytdBookings.length,
      totalClients: clients.length,
      avgBookingValue,
      conversionRate,
      pendingCommissions: totalPending,
      paidCommissions: totalPaid,
    };
  }, [bookings, clients, commissions]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-md">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name === "revenue" ? formatCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-1">Agency performance metrics and insights</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">Agency performance metrics and insights</p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(kpis?.totalRevenue || 0)}
            change={`${formatCurrency(kpis?.ytdRevenue || 0)} YTD`}
            changeType="neutral"
            icon={DollarSign}
          />
          <StatCard
            title="Total Bookings"
            value={kpis?.totalBookings?.toString() || "0"}
            change={`${kpis?.ytdBookings || 0} this year`}
            changeType="neutral"
            icon={Plane}
          />
          <StatCard
            title="Total Clients"
            value={kpis?.totalClients?.toString() || "0"}
            change={`${kpis?.conversionRate?.toFixed(0) || 0}% conversion rate`}
            changeType="neutral"
            icon={Users}
          />
          <StatCard
            title="Avg. Booking Value"
            value={formatCurrency(kpis?.avgBookingValue || 0)}
            description="Per booking average"
            icon={Target}
          />
        </div>

        {/* Commission Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Commissions</p>
                  <p className="text-2xl font-bold">{formatCurrency(kpis?.pendingCommissions || 0)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid Commissions</p>
                  <p className="text-2xl font-bold">{formatCurrency(kpis?.paidCommissions || 0)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Revenue Trend
              </CardTitle>
              <CardDescription>Monthly revenue over the last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevenueData}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Booking Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                Booking Status
              </CardTitle>
              <CardDescription>Distribution of booking statuses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {bookingStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bookingStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {bookingStatusData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No booking data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Destinations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Destinations
              </CardTitle>
              <CardDescription>Revenue by destination</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {topDestinations.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topDestinations} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={100}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No destination data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Client Acquisition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Client Acquisition
              </CardTitle>
              <CardDescription>New clients per month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clientAcquisitionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={30} />
                    <Tooltip />
                    <Bar dataKey="clients" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;
