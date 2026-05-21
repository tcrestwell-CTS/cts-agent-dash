import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet, DollarSign, TrendingUp, Users, Percent } from "lucide-react";
import { useCommissionReport } from "@/hooks/useCommissionReport";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useIsAdmin, useIsOfficeAdmin } from "@/hooks/useAdmin";
import { useEarningsLabel } from "@/hooks/useEarningsLabel";
import { CommissionReportFilters } from "@/components/reports/CommissionReportFilters";
import { CommissionReportTable } from "@/components/reports/CommissionReportTable";
import { exportToCSV, formatCurrencyForExport, formatDateForExport } from "@/lib/csvExport";
import { calculateAgentCommission, getTierConfig, CommissionTier } from "@/lib/commissionTiers";
import { toast } from "sonner";
import {
  format, parseISO, isWithinInterval, startOfDay, endOfDay,
  startOfMonth, endOfMonth, startOfYear, subMonths,
  eachMonthOfInterval, subMonths as subM,
} from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DateRange } from "react-day-picker";


export default function CommissionReport() {
  const { data: reportData, isLoading: reportLoading } = useCommissionReport();
  const { suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { data: isAdmin } = useIsAdmin();
  const { data: isOfficeAdmin } = useIsOfficeAdmin();
  const earnings = useEarningsLabel();

  const canViewAll = isAdmin || isOfficeAdmin;
  const loading = reportLoading || suppliersLoading;

  // Filter states
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const clearFilters = () => {
    setDateRange(undefined);
    setSelectedSupplier("all");
    setSelectedAgent("all");
    setSelectedStatus("all");
  };

  // Apply filters
  const filteredData = useMemo(() => {
    if (!reportData) return [];

    return reportData.filter((item) => {
      // Date range filter
      if (dateRange?.from) {
        const itemDate = parseISO(item.created_at);
        const start = startOfDay(dateRange.from);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        if (!isWithinInterval(itemDate, { start, end })) return false;
      }

      // Supplier filter
      if (selectedSupplier !== "all") {
        if (selectedSupplier === "none") {
          if (item.booking?.supplier_id) return false;
        } else {
          if (item.booking?.supplier_id !== selectedSupplier) return false;
        }
      }

      // Agent filter
      if (selectedAgent !== "all" && item.user_id !== selectedAgent) return false;

      // Status filter
      if (selectedStatus !== "all" && item.status !== selectedStatus) return false;

      return true;
    });
  }, [reportData, dateRange, selectedSupplier, selectedAgent, selectedStatus]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalCommission = filteredData.reduce((sum, item) => sum + item.amount, 0);
    const totalAgentShare = filteredData.reduce((sum, item) => {
      const tier = (item.agent?.commission_tier || "tier_1") as CommissionTier;
      return sum + calculateAgentCommission(item.amount, tier);
    }, 0);
    const totalGrossSales = filteredData.reduce(
      (sum, item) => sum + (item.booking?.gross_sales || item.booking?.total_amount || 0),
      0
    );
    const uniqueAgents = new Set(filteredData.map((item) => item.user_id)).size;
    const paidCount = filteredData.filter((item) => item.status === "paid").length;
    const pendingCount = filteredData.filter((item) => item.status === "pending").length;
    const marginPct = totalGrossSales > 0 ? (totalCommission / totalGrossSales) * 100 : 0;

    return {
      totalCommission,
      totalAgentShare,
      totalGrossSales,
      uniqueAgents,
      count: filteredData.length,
      paidCount,
      pendingCount,
      marginPct,
    };
  }, [filteredData]);

  // Monthly data for chart
  const monthlyData = useMemo(() => {
    if (!filteredData.length) return [];
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 11),
      end: new Date(),
    });
    return months.map((month) => {
      const monthStr = format(month, "MMM yy");
      const monthItems = filteredData.filter((item) => {
        const d = parseISO(item.created_at);
        return d >= startOfMonth(month) && d <= endOfMonth(month);
      });
      return {
        month: monthStr,
        earned: monthItems.reduce((s, i) => s + i.amount, 0),
        paid: monthItems.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0),
      };
    }).filter(m => m.earned > 0 || m.paid > 0);
  }, [filteredData]);

  // Supplier breakdown
  const supplierBreakdown = useMemo(() => {
    const bySupplier: Record<string, { name: string; grossSales: number; commission: number; count: number }> = {};
    filteredData.forEach((item) => {
      const name = item.booking?.supplier?.name || "Unknown";
      if (!bySupplier[name]) bySupplier[name] = { name, grossSales: 0, commission: 0, count: 0 };
      bySupplier[name].grossSales += item.booking?.gross_sales || 0;
      bySupplier[name].commission += item.amount;
      bySupplier[name].count += 1;
    });
    return Object.values(bySupplier).sort((a, b) => b.commission - a.commission);
  }, [filteredData]);

  // Advisor profitability breakdown (admin only)
  const advisorProfitability = useMemo(() => {
    if (!canViewAll || !filteredData.length) return [];

    const byAgent = filteredData.reduce((acc, item) => {
      const userId = item.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          name: item.agent?.full_name || "Unknown",
          tier: (item.agent?.commission_tier || "tier_1") as CommissionTier,
          grossSales: 0,
          totalCommission: 0,
          agentEarnings: 0,
          tripCount: new Set<string>(),
        };
      }
      acc[userId].grossSales += item.booking?.gross_sales || item.booking?.total_amount || 0;
      acc[userId].totalCommission += item.amount;
      acc[userId].agentEarnings += calculateAgentCommission(item.amount, acc[userId].tier);
      if (item.booking?.trip_id) acc[userId].tripCount.add(item.booking.trip_id);
      return acc;
    }, {} as Record<string, any>);

    return Object.entries(byAgent)
      .map(([userId, data]) => ({
        userId,
        name: data.name,
        tierLabel: getTierConfig(data.tier).label,
        grossSales: data.grossSales,
        totalCommission: data.totalCommission,
        agentEarnings: data.agentEarnings,
        tripCount: data.tripCount.size,
        margin: data.grossSales > 0 ? (data.totalCommission / data.grossSales) * 100 : 0,
      }))
      .sort((a, b) => b.agentEarnings - a.agentEarnings);
  }, [canViewAll, filteredData]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  const handleExport = () => {
    if (!filteredData.length) {
      toast.error("No data to export");
      return;
    }

    const exportData = filteredData.map((item) => {
      const tier = (item.agent?.commission_tier || "tier_1") as CommissionTier;
      const agentShare = calculateAgentCommission(item.amount, tier);
      const tierConfig = getTierConfig(tier);

      return {
        date: formatDateForExport(item.created_at),
        booking_reference: item.booking?.booking_reference || "N/A",
        client: item.booking?.client?.name || "Unknown",
        agent: item.agent?.full_name || "Unknown",
        agent_tier: tierConfig.description,
        supplier: item.booking?.supplier?.name || "",
        destination: item.booking?.destination || "N/A",
        gross_sales: formatCurrencyForExport(
          item.booking?.gross_sales || item.booking?.total_amount || 0
        ),
        commission_rate: `${item.rate}%`,
        total_commission: formatCurrencyForExport(item.amount),
        agent_share: formatCurrencyForExport(agentShare),
        agency_share: formatCurrencyForExport(item.amount - agentShare),
        status: item.status,
        paid_date: item.paid_at ? formatDateForExport(item.paid_at) : "",
      };
    });

    exportToCSV(exportData, `commission-report-${format(new Date(), "yyyy-MM-dd")}`);
    toast.success("Report exported");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {earnings.reportTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {canViewAll
                ? "Organization-wide commission analysis"
                : `Your ${earnings.singularLower} history and analysis`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick date presets */}
            {[
              { label: "This Month", range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) } },
              { label: "Last Month", range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } },
              { label: "YTD",        range: { from: startOfYear(new Date()), to: new Date() } },
            ].map(({ label, range }) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => setDateRange(range)}
              >
                {label}
              </Button>
            ))}
            <Button onClick={handleExport} size="sm" className="gap-1.5 h-8">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────────── */}
        <CommissionReportFilters
          dateRange={dateRange}
          setDateRange={setDateRange}
          selectedSupplier={selectedSupplier}
          setSelectedSupplier={setSelectedSupplier}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          suppliers={suppliers}
          agents={[]}
          showAgentFilter={canViewAll || false}
          onClearFilters={clearFilters}
        />

        {/* ── Summary Stat Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Gross Sales",
              value: formatCurrency(stats.totalGrossSales),
              sub: `${stats.count} booking${stats.count !== 1 ? "s" : ""}`,
              icon: FileSpreadsheet,
              color: "text-foreground",
              bg: "",
            },
            {
              label: "Commission Earned",
              value: formatCurrency(stats.totalCommission),
              sub: `${stats.marginPct.toFixed(1)}% margin`,
              icon: TrendingUp,
              color: "text-primary",
              bg: "bg-primary/5 border-primary/20",
            },
            {
              label: "Agent Payouts",
              value: formatCurrency(stats.totalAgentShare),
              sub: "After tier splits",
              icon: DollarSign,
              color: "text-green-600",
              bg: "bg-green-50 border-green-200",
            },
            {
              label: "Agency Revenue",
              value: formatCurrency(stats.totalCommission - stats.totalAgentShare),
              sub: "Agency net",
              icon: Percent,
              color: "text-foreground",
              bg: "",
            },
            {
              label: canViewAll ? "Active Advisors" : "Status",
              value: canViewAll ? String(stats.uniqueAgents) : `${stats.paidCount} paid`,
              sub: canViewAll ? `${stats.paidCount} paid · ${stats.pendingCount} pending` : `${stats.pendingCount} pending`,
              icon: Users,
              color: "text-foreground",
              bg: "",
            },
          ].map(({ label, value, sub, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-xl p-4 border shadow-sm bg-card ${bg}`}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                <Icon className={`h-4 w-4 ${color} opacity-60`} />
              </div>
              <p className={`text-2xl font-bold tracking-tight tabular-nums ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Monthly Revenue Chart ───────────────────────────────────── */}
        {monthlyData.length > 1 && (
          <div className="rounded-xl border bg-card shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Commission by Month</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Earned vs paid</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), ""]}
                  contentStyle={{
                    fontSize: 12,
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    background: "hsl(var(--popover))",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Bar dataKey="earned" name="Earned" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                <Bar dataKey="paid"   name="Paid"   fill="hsl(var(--success))"  radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 justify-center">
              {[
                { color: "bg-primary", label: "Earned" },
                { color: "bg-success", label: "Paid" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Supplier Breakdown (admin) ──────────────────────────────── */}
        {canViewAll && supplierBreakdown.length > 0 && (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Top Suppliers by Commission</h2>
            </div>
            <div className="divide-y divide-border">
              {supplierBreakdown.slice(0, 8).map((s) => (
                <div key={s.name} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.count} booking{s.count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm tabular-nums">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Gross Sales</p>
                      <p className="font-medium">{formatCurrency(s.grossSales)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Commission</p>
                      <p className="font-semibold text-primary">{formatCurrency(s.commission)}</p>
                    </div>
                    <div className="w-20 hidden md:block">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, (s.commission / supplierBreakdown[0].commission) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Advisor Profitability (admin) ────────────────────────────── */}
        {canViewAll && advisorProfitability.length > 0 && (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Advisor Profitability</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Advisor", "Tier", "Gross Sales", "Commission", "Agent Earnings", "Trips", "Margin"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {advisorProfitability.map((a) => (
                    <tr key={a.userId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">{a.name}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {a.tierLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3 tabular-nums">{formatCurrency(a.grossSales)}</td>
                      <td className="px-5 py-3 tabular-nums font-medium text-primary">{formatCurrency(a.totalCommission)}</td>
                      <td className="px-5 py-3 tabular-nums text-green-600 font-medium">{formatCurrency(a.agentEarnings)}</td>
                      <td className="px-5 py-3 tabular-nums text-muted-foreground">{a.tripCount}</td>
                      <td className="px-5 py-3 tabular-nums text-muted-foreground">{a.margin.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Commission Detail Table ─────────────────────────────────── */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              Commission Detail
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {filteredData.length} record{filteredData.length !== 1 ? "s" : ""}
              </span>
            </h2>
          </div>
          <CommissionReportTable data={filteredData} showAgentColumn={canViewAll || false} />
        </div>

      </div>
    </DashboardLayout>
  );
}
