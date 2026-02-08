import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  TrendingUp,
  DollarSign,
  Calendar,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { useCommissions } from "@/hooks/useCommissions";
import { useBookings } from "@/hooks/useBookings";
import { useClients } from "@/hooks/useClients";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useAdmin";
import { PendingOverridesCard } from "@/components/commissions/PendingOverridesCard";
import { useMemo } from "react";
import { format, parseISO, startOfMonth, subMonths, subDays, startOfYear, isWithinInterval, isPast, differenceInDays } from "date-fns";
import { calculateAgentCommission, getTierConfig } from "@/lib/commissionTiers";
import { exportToCSV, formatCurrencyForExport, formatDateForExport } from "@/lib/csvExport";
import { toast } from "sonner";

const Commissions = () => {
  const { data: commissions, isLoading: commissionsLoading } = useCommissions();
  const { bookings, loading: bookingsLoading } = useBookings();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { profile, loading: profileLoading } = useProfile();
  const { data: isAdmin } = useIsAdmin();

  const loading = commissionsLoading || bookingsLoading || clientsLoading || profileLoading;

  // Get commission tier config for the current user
  const tierConfig = getTierConfig(profile?.commission_tier);

  // Combine commission data with booking and client info
  const enrichedCommissions = useMemo(() => {
    if (!commissions || !bookings || !clients) return [];

    return commissions.map((commission) => {
      const booking = bookings.find((b) => b.id === commission.booking_id);
      const client = booking ? clients.find((c) => c.id === booking.client_id) : null;
      
      // Calculate expected commission date (30 days before departure)
      const expectedCommissionDate = booking 
        ? subDays(new Date(booking.depart_date), 30)
        : null;

      return {
        ...commission,
        booking,
        client,
        agentShare: calculateAgentCommission(commission.amount, profile?.commission_tier),
        expectedCommissionDate,
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [commissions, bookings, clients, profile?.commission_tier]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!enrichedCommissions.length) {
      return { totalEarned: 0, thisMonth: 0, paid: 0, pending: 0, paidCount: 0, pendingCount: 0 };
    }

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const yearStart = startOfYear(now);

    const totalEarned = enrichedCommissions
      .reduce((sum, c) => sum + c.agentShare, 0);

    const thisMonth = enrichedCommissions
      .filter((c) => {
        const createdDate = parseISO(c.created_at);
        return isWithinInterval(createdDate, { start: thisMonthStart, end: now });
      })
      .reduce((sum, c) => sum + c.agentShare, 0);

    const paidCommissions = enrichedCommissions.filter((c) => c.status === "paid");
    const pendingCommissions = enrichedCommissions.filter((c) => c.status === "pending");

    return {
      totalEarned,
      thisMonth,
      paid: paidCommissions.reduce((sum, c) => sum + c.agentShare, 0),
      pending: pendingCommissions.reduce((sum, c) => sum + c.agentShare, 0),
      paidCount: paidCommissions.length,
      pendingCount: pendingCommissions.length,
    };
  }, [enrichedCommissions]);

  // Monthly earnings data for chart
  const monthlyData = useMemo(() => {
    if (!enrichedCommissions.length) return [];

    const months: { month: string; earned: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = startOfMonth(subMonths(now, i));
      const monthEnd = i === 0 ? now : startOfMonth(subMonths(now, i - 1));
      
      const monthEarnings = enrichedCommissions
        .filter((c) => {
          const createdDate = parseISO(c.created_at);
          return isWithinInterval(createdDate, { start: monthDate, end: monthEnd });
        })
        .reduce((sum, c) => sum + c.agentShare, 0);

      months.push({
        month: format(monthDate, "MMM"),
        earned: monthEarnings,
      });
    }

    return months;
  }, [enrichedCommissions]);

  const maxEarned = Math.max(...monthlyData.map((d) => d.earned), 1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleExport = () => {
    if (!enrichedCommissions.length) {
      toast.error("No commission data to export");
      return;
    }

    const exportData = enrichedCommissions.map((c) => ({
      booking_reference: c.booking?.booking_reference || "N/A",
      client_name: c.client?.name || "Unknown",
      destination: c.booking?.destination || "N/A",
      booking_amount: formatCurrencyForExport(c.booking?.total_amount || 0),
      commission_rate: `${c.rate}%`,
      total_commission: formatCurrencyForExport(c.amount),
      your_share: formatCurrencyForExport(c.agentShare),
      expected_date: c.expectedCommissionDate ? formatDateForExport(format(c.expectedCommissionDate, "yyyy-MM-dd")) : "",
      status: c.status,
      paid_date: c.paid_date ? formatDateForExport(c.paid_date) : "",
    }));

    exportToCSV(exportData, `my_commissions_${format(new Date(), "yyyy-MM-dd")}`, [
      { key: "booking_reference", header: "Booking" },
      { key: "client_name", header: "Client" },
      { key: "destination", header: "Destination" },
      { key: "booking_amount", header: "Booking Amount ($)" },
      { key: "commission_rate", header: "Rate" },
      { key: "total_commission", header: "Total Commission ($)" },
      { key: "your_share", header: "Your Share ($)" },
      { key: "expected_date", header: "Expected Date" },
      { key: "status", header: "Status" },
      { key: "paid_date", header: "Paid Date" },
    ]);
    toast.success("Commissions exported successfully");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64 lg:col-span-2" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            My Commissions
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your earnings and payment history • {tierConfig.description}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Admin: Pending Override Approvals */}
      {isAdmin && <div className="mb-6"><PendingOverridesCard /></div>}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Earned (Your Share)</p>
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-card-foreground">
            {formatCurrency(totals.totalEarned)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {tierConfig.agentSplit}% of total commissions
          </p>
        </div>

        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">This Month</p>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-card-foreground">
            {formatCurrency(totals.thisMonth)}
          </p>
          {totals.thisMonth > 0 && (
            <div className="flex items-center gap-1 mt-2 text-success">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Earnings this month</span>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Paid</p>
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-success">
            {formatCurrency(totals.paid)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {totals.paidCount} payment{totals.paidCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Pending</p>
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-warning" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-warning">
            {formatCurrency(totals.pending)}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {totals.pendingCount} pending
          </p>
        </div>
      </div>

      {/* Chart and Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">
            Your Earnings Trend
          </h3>
          {monthlyData.length > 0 && monthlyData.some((d) => d.earned > 0) ? (
            <div className="flex items-end justify-between gap-3 h-48">
              {monthlyData.map((data) => (
                <div
                  key={data.month}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div
                    className="w-full bg-primary rounded-t transition-all hover:bg-primary/80 relative group"
                    style={{ height: `${Math.max((data.earned / maxEarned) * 100, 4)}%` }}
                  >
                    {data.earned > 0 && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card px-2 py-1 rounded shadow text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border">
                        {formatCurrency(data.earned)}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {data.month}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No earnings data yet
            </div>
          )}
        </div>

        {/* Table */}
        <div className="lg:col-span-2 bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-lg font-semibold text-card-foreground">
              Your Commission History
            </h3>
          </div>
          {enrichedCommissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Booking Amt</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Your Share</TableHead>
                  <TableHead>Expected Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedCommissions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.booking?.booking_reference || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.client?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.booking?.destination || "N/A"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.booking?.total_amount || 0)}
                    </TableCell>
                    <TableCell className="text-right">{item.rate}%</TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      {formatCurrency(item.agentShare)}
                    </TableCell>
                    <TableCell>
                      {item.expectedCommissionDate && (
                        <div>
                          <p className={`text-sm font-medium ${isPast(item.expectedCommissionDate) ? "text-success" : "text-foreground"}`}>
                            {format(item.expectedCommissionDate, "MMM d, yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isPast(item.expectedCommissionDate)
                              ? "Available"
                              : `${differenceInDays(item.expectedCommissionDate, new Date())} days`}
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          item.status === "paid"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No commissions yet. Create bookings to start earning commissions.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Commissions;
