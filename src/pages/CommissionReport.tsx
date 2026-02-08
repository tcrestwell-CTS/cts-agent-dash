import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet, DollarSign, TrendingUp, Users } from "lucide-react";
import { useCommissionReport, useAgentList } from "@/hooks/useCommissionReport";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useIsAdmin, useIsOfficeAdmin } from "@/hooks/useAdmin";
import { CommissionReportFilters } from "@/components/reports/CommissionReportFilters";
import { CommissionReportTable } from "@/components/reports/CommissionReportTable";
import { exportToCSV, formatCurrencyForExport, formatDateForExport } from "@/lib/csvExport";
import { calculateAgentCommission, getTierConfig, CommissionTier } from "@/lib/commissionTiers";
import { toast } from "sonner";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";

export default function CommissionReport() {
  const { data: reportData, isLoading: reportLoading } = useCommissionReport();
  const { suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { data: agents, isLoading: agentsLoading } = useAgentList();
  const { data: isAdmin } = useIsAdmin();
  const { data: isOfficeAdmin } = useIsOfficeAdmin();

  const canViewAll = isAdmin || isOfficeAdmin;
  const loading = reportLoading || suppliersLoading || agentsLoading;

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

    return {
      totalCommission,
      totalAgentShare,
      totalGrossSales,
      uniqueAgents,
      count: filteredData.length,
      paidCount,
      pendingCount,
    };
  }, [filteredData]);

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
        paid_date: item.paid_date ? formatDateForExport(item.paid_date) : "",
      };
    });

    const dateStr = format(new Date(), "yyyy-MM-dd");
    const filename = `commission_report_${dateStr}`;

    exportToCSV(exportData, filename, [
      { key: "date", header: "Date" },
      { key: "booking_reference", header: "Booking Ref" },
      { key: "client", header: "Client" },
      { key: "agent", header: "Agent" },
      { key: "agent_tier", header: "Agent Tier" },
      { key: "supplier", header: "Supplier" },
      { key: "destination", header: "Destination" },
      { key: "gross_sales", header: "Gross Sales ($)" },
      { key: "commission_rate", header: "Rate" },
      { key: "total_commission", header: "Total Commission ($)" },
      { key: "agent_share", header: "Agent Share ($)" },
      { key: "agency_share", header: "Agency Share ($)" },
      { key: "status", header: "Status" },
      { key: "paid_date", header: "Paid Date" },
    ]);

    toast.success("Commission report exported successfully");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">
              Commission Report
            </h1>
            <p className="text-muted-foreground mt-1">
              {canViewAll
                ? "Organization-wide commission analysis and export"
                : "Your commission history and analysis"}
            </p>
          </div>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
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
          agents={agents || []}
          showAgentFilter={canViewAll || false}
          onClearFilters={clearFilters}
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Gross Sales</p>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold">{formatCurrency(stats.totalGrossSales)}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.count} bookings</p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Commission</p>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-semibold text-primary">
              {formatCurrency(stats.totalCommission)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.paidCount} paid, {stats.pendingCount} pending
            </p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Agent Payouts</p>
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <p className="text-2xl font-semibold text-success">
              {formatCurrency(stats.totalAgentShare)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Based on tier splits</p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Agency Revenue</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold">
              {formatCurrency(stats.totalCommission - stats.totalAgentShare)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {canViewAll ? `${stats.uniqueAgents} agents` : "After agent split"}
            </p>
          </div>
        </div>

        {/* Table */}
        <CommissionReportTable data={filteredData} showAgentColumn={canViewAll || false} />
      </div>
    </DashboardLayout>
  );
}
