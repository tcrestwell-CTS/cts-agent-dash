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
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { useCommissions } from "@/hooks/useCommissions";
import { useBookings } from "@/hooks/useBookings";
import { useClients } from "@/hooks/useClients";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin, useIsOfficeAdmin, useIsBookkeeper } from "@/hooks/useAdmin";
import { useEarningsLabel } from "@/hooks/useEarningsLabel";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";
import { PendingOverridesCard } from "@/components/commissions/PendingOverridesCard";
import { CommissionStatusBadge } from "@/components/commissions/CommissionStatusBadge";
import { CommissionAgingReport } from "@/components/commissions/CommissionAgingReport";
import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, subMonths, subDays, isWithinInterval, isPast, differenceInDays } from "date-fns";
import { calculateAgentCommission, getTierConfig, CommissionTier } from "@/lib/commissionTiers";
import { exportToCSV, formatCurrencyForExport, formatDateForExport } from "@/lib/csvExport";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const ITEMS_PER_PAGE = 25;

const Commissions = () => {
  const { data: commissions, isLoading: commissionsLoading } = useCommissions();
  const { bookings, loading: bookingsLoading } = useBookings();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { profile, loading: profileLoading } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const { data: isOfficeAdmin } = useIsOfficeAdmin();
  const { data: isBookkeeper } = useIsBookkeeper();
  const canViewAgencyWide = !!isAdmin || !!isOfficeAdmin || !!isBookkeeper;
  const earnings = useEarningsLabel();
  const { data: teamProfiles, isLoading: teamProfilesLoading } = useTeamProfiles();
  const [currentPage, setCurrentPage] = useState(1);

  const loading = commissionsLoading || bookingsLoading || clientsLoading || profileLoading || (canViewAgencyWide && teamProfilesLoading);

  const tierConfig = getTierConfig(profile?.commission_tier);

  // Build a lookup of user_id -> profile so agency-wide viewers can see the
  // selling agent per row, and each agent row can show the correct split %.
  const profileByUser = useMemo(() => {
    const m = new Map<string, { full_name: string | null; commission_tier: CommissionTier | null }>();
    for (const p of teamProfiles ?? []) {
      m.set(p.user_id, {
        full_name: p.full_name ?? null,
        commission_tier: (p.commission_tier as CommissionTier | null) ?? null,
      });
    }
    return m;
  }, [teamProfiles]);

  // Build lookup maps to avoid O(n²) scans
  const bookingMap = useMemo(
    () => new Map((bookings || []).map((b) => [b.id, b])),
    [bookings]
  );
  const clientMap = useMemo(
    () => new Map((clients || []).map((c) => [c.id, c])),
    [clients]
  );

  // Combine commission data with booking and client info using Maps
  const enrichedCommissions = useMemo(() => {
    if (!commissions || !bookings || !clients) return [];

    return commissions
      .map((commission) => {
        const booking = bookingMap.get(commission.booking_id);
        const client = booking ? clientMap.get(booking.client_id) : undefined;

        const departDate = booking?.depart_date ? new Date(booking.depart_date + "T00:00:00") : null;
        const expectedCommissionDate = departDate && !isNaN(departDate.getTime())
          ? subDays(departDate, 30)
          : null;

        // Score each row against the *selling agent's* tier when viewing
        // agency-wide; agents themselves always see their own split.
        const rowTier = (canViewAgencyWide
          ? profileByUser.get(commission.user_id)?.commission_tier ?? null
          : (profile?.commission_tier as CommissionTier | null) ?? null);
        const rowTierConfig = getTierConfig(rowTier);

        return {
          ...commission,
          booking,
          client,
          agentShare: calculateAgentCommission(commission.amount, rowTier),
          agentName: profileByUser.get(commission.user_id)?.full_name ?? null,
          splitPct: rowTierConfig.agentSplit,
          expectedCommissionDate,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [commissions, bookings, clients, profile?.commission_tier, bookingMap, clientMap, canViewAgencyWide, profileByUser]);

  // Calculate totals including holdback
  const totals = useMemo(() => {
    if (!enrichedCommissions.length) {
      return { expected: 0, received: 0, paidYTD: 0, overSixty: 0, overSixtyCount: 0, thisMonth: 0, paid: 0, pending: 0, paidCount: 0, pendingCount: 0, totalEarned: 0, holdbackTotal: 0, holdbackReleasedCount: 0 };
    }

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const sixtyDaysAgo = subDays(now, 60);

    // Amount basis: agency-wide viewers see the full commission amount;
    // agents see their own share after the tier split.
    const rowAmount = (c: (typeof enrichedCommissions)[number]) =>
      canViewAgencyWide ? c.amount : c.agentShare;

    const expected = enrichedCommissions
      .filter((c) => c.status !== "paid")
      .reduce((sum, c) => sum + rowAmount(c), 0);

    const received = enrichedCommissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + rowAmount(c), 0);

    const paidYTD = enrichedCommissions
      .filter((c) => {
        if (c.status !== "paid" || !c.paid_date) return false;
        return parseISO(c.paid_date) >= yearStart;
      })
      .reduce((sum, c) => sum + rowAmount(c), 0);

    const overSixtyRows = enrichedCommissions.filter((c) => {
      if (c.status === "paid") return false;
      return parseISO(c.created_at) <= sixtyDaysAgo;
    });
    const overSixty = overSixtyRows.reduce((sum, c) => sum + rowAmount(c), 0);
    const overSixtyCount = overSixtyRows.length;

    const totalEarned = enrichedCommissions.reduce((sum, c) => sum + rowAmount(c), 0);

    const thisMonth = enrichedCommissions
      .filter((c) => {
        const createdDate = parseISO(c.created_at);
        return isWithinInterval(createdDate, { start: thisMonthStart, end: now });
      })
      .reduce((sum, c) => sum + rowAmount(c), 0);

    const paidCommissions = enrichedCommissions.filter((c) => c.status === "paid");
    const pendingCommissions = enrichedCommissions.filter((c) => c.status === "pending");

    // Holdback calc moved here from inline JSX
    const holdbackTotal = (commissions || [])
      .filter((c) => !c.holdback_released && c.holdback_amount > 0)
      .reduce((sum, c) => sum + c.holdback_amount, 0);

    const holdbackReleasedCount = (commissions || []).filter((c) => c.holdback_released).length;

    return {
      expected,
      received,
      paidYTD,
      overSixty,
      overSixtyCount,
      totalEarned,
      thisMonth,
      paid: paidCommissions.reduce((sum, c) => sum + rowAmount(c), 0),
      pending: pendingCommissions.reduce((sum, c) => sum + rowAmount(c), 0),
      paidCount: paidCommissions.length,
      pendingCount: pendingCommissions.length,
      holdbackTotal,
      holdbackReleasedCount,
    };
  }, [enrichedCommissions, commissions, canViewAgencyWide]);

  // Monthly earnings data for Recharts
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

  // Agency-wide (admin/office admin/bookkeeper): Agent breakdown with earnings per agent
  const agentBreakdown = useMemo(() => {
    if (!canViewAgencyWide || !commissions || !teamProfiles) return [];

    const commissionsByAgent = commissions.reduce((acc, commission) => {
      const userId = commission.user_id;
      if (!acc[userId]) acc[userId] = [];
      acc[userId].push(commission);
      return acc;
    }, {} as Record<string, typeof commissions>);

    return teamProfiles
      .map((agent) => {
        const agentCommissions = commissionsByAgent[agent.user_id] || [];
        const tier = agent.commission_tier as CommissionTier | null;
        const agentTierConfig = getTierConfig(tier);

        const totalCommission = agentCommissions.reduce((sum, c) => sum + c.amount, 0);
        const agentEarnings = agentCommissions.reduce(
          (sum, c) => sum + calculateAgentCommission(c.amount, tier),
          0
        );
        const pendingCount = agentCommissions.filter((c) => c.status === "pending").length;
        const paidCount = agentCommissions.filter((c) => c.status === "paid").length;

        return {
          userId: agent.user_id,
          name: agent.full_name || "Unknown Agent",
          tier: tier || "tier_1",
          tierLabel: agentTierConfig.label,
          agentSplit: agentTierConfig.agentSplit,
          totalCommission,
          agentEarnings,
          bookingCount: agentCommissions.length,
          pendingCount,
          paidCount,
        };
      })
      .filter((agent) => agent.bookingCount > 0)
      .sort((a, b) => b.agentEarnings - a.agentEarnings);
  }, [isAdmin, commissions, teamProfiles]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(enrichedCommissions.length / ITEMS_PER_PAGE));
  const paginatedCommissions = useMemo(
    () => enrichedCommissions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [enrichedCommissions, currentPage]
  );

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{canViewAgencyWide ? earnings.teamTitle : earnings.myTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">{canViewAgencyWide
            ? "View all agent commission earnings agency-wide"
            : `Track your earnings and payment history • Your Rate: ${tierConfig.agentSplit}%`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Admin: Pending Override Approvals */}
      {isAdmin && <div className="mb-6"><PendingOverridesCard /></div>}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: canViewAgencyWide ? "Agency expected" : "My expected",
            value: formatCurrency(totals.expected),
            sub: `${totals.pendingCount} open`,
            icon: DollarSign,
            tone: "text-foreground",
            bg: "bg-primary/10",
            iconTone: "text-primary",
          },
          {
            label: canViewAgencyWide ? "Agency received" : "My received",
            value: formatCurrency(totals.received),
            sub: `${totals.paidCount} settled`,
            icon: TrendingUp,
            tone: "text-success",
            bg: "bg-success/10",
            iconTone: "text-success",
          },
          {
            label: canViewAgencyWide ? "Paid out YTD" : "Paid to me YTD",
            value: formatCurrency(totals.paidYTD),
            sub: `Since Jan 1, ${new Date().getFullYear()}`,
            icon: Calendar,
            tone: "text-foreground",
            bg: "bg-accent/10",
            iconTone: "text-accent",
          },
          {
            label: canViewAgencyWide ? "Over 60 days" : "My lines over 60 days",
            value: formatCurrency(totals.overSixty),
            sub: `${totals.overSixtyCount} line${totals.overSixtyCount === 1 ? "" : "s"}`,
            icon: ArrowUpRight,
            tone: totals.overSixty > 0 ? "text-warning" : "text-foreground",
            bg: "bg-warning/10",
            iconTone: "text-warning",
          },
        ].map(({ label, value, sub, icon: Icon, tone, bg, iconTone }) => (
          <div key={label} className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{label}</p>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${bg}`}>
                <Icon className={`h-5 w-5 ${iconTone}`} />
              </div>
            </div>
            <p className={`text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
            <p className="text-sm text-muted-foreground mt-2">{sub}</p>
          </div>
        ))}
        {!canViewAgencyWide && (
          <p className="md:col-span-4 text-xs text-muted-foreground -mt-2">
            Amounts reflect your {tierConfig.agentSplit}% share after the tier split.
          </p>
        )}
      </div>

      {/* Agency-wide: Agent Breakdown */}
      {canViewAgencyWide && agentBreakdown.length > 0 && (
        <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden mb-6">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-card-foreground">
              Agent Commission Breakdown
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Commission Tier</TableHead>
                <TableHead className="text-right">Agent Rate</TableHead>
                <TableHead className="text-right">Total Commission</TableHead>
                <TableHead className="text-right">Agent Earnings</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentBreakdown.map((agent) => (
                <TableRow key={agent.userId}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {agent.tierLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{agent.agentSplit}%</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(agent.totalCommission)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    {formatCurrency(agent.agentEarnings)}
                  </TableCell>
                  <TableCell className="text-right">{agent.bookingCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {agent.paidCount > 0 && (
                        <Badge variant="secondary" className="bg-success/10 text-success">
                          {agent.paidCount} paid
                        </Badge>
                      )}
                      {agent.pendingCount > 0 && (
                        <Badge variant="secondary" className="bg-warning/10 text-warning">
                          {agent.pendingCount} pending
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Commission Aging Report */}
      <CommissionAgingReport commissions={enrichedCommissions} />

      {/* Chart and Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Bar Chart */}
        <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">
            Your Earnings Trend
          </h3>
          {monthlyData.length > 0 && monthlyData.some((d) => d.earned > 0) ? (
            <ResponsiveContainer width="100%" height={192}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  width={45}
                />
                <RechartsTooltip
                  formatter={(value: number) => [formatCurrency(value), "Earned"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="earned" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No earnings data yet
            </div>
          )}
        </div>

        {/* Table with Pagination */}
        <div className="lg:col-span-2 bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold text-card-foreground">
              {canViewAgencyWide ? `All ${earnings.plural}` : `Your ${earnings.singular} History`}
            </h3>
            {enrichedCommissions.length > ITEMS_PER_PAGE && (
              <p className="text-sm text-muted-foreground">
                {enrichedCommissions.length} total
              </p>
            )}
          </div>
          {enrichedCommissions.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Client</TableHead>
                    {canViewAgencyWide && <TableHead>Agent</TableHead>}
                    <TableHead className="text-right">Booking Amt</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">
                      {canViewAgencyWide ? "Commission" : "My Share"}
                    </TableHead>
                    <TableHead>Expected Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCommissions.map((item) => (
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
                      {canViewAgencyWide && (
                        <TableCell>
                          <p className="text-sm">{item.agentName || "—"}</p>
                          <p className="text-xs text-muted-foreground">{item.splitPct}% split</p>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        {formatCurrency(item.booking?.total_amount || 0)}
                      </TableCell>
                      <TableCell className="text-right">{item.rate}%</TableCell>
                      <TableCell className="text-right">
                        <p className="font-semibold text-success tabular-nums">
                          {formatCurrency(canViewAgencyWide ? item.amount : item.agentShare)}
                        </p>
                        {!canViewAgencyWide && (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            at {item.splitPct}% split
                          </p>
                        )}
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
                        <CommissionStatusBadge
                          status={item.status}
                          expectedDate={item.expectedCommissionDate ? item.expectedCommissionDate.toISOString() : null}
                          daysLabel
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, enrichedCommissions.length)} of {enrichedCommissions.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
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
