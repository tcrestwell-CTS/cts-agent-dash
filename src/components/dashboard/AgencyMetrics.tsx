import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader, PanelBody, EmptyState } from "@/components/patterns/Panel";
import { KPITile, KPIGrid } from "@/components/patterns/KPITile";
import { useBookings, isBookingArchived } from "@/hooks/useBookings";
import { useCommissions } from "@/hooks/useCommissions";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";
import { useAdminUserIds } from "@/hooks/useAdminUserIds";
import { calculateAgencyCommission, CommissionTier } from "@/lib/commissionTiers";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  isWithinInterval,
  isValid,
} from "date-fns";
import { Building2, CheckCircle2 } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { Badge } from "@/components/ui/badge";
import { OpsAlerts } from "@/components/dashboard/OpsAlerts";
import { useAgencyOtherIncome } from "@/hooks/useAgencyOtherIncome";

type DateRange = "mtd" | "ytd";

const getBookingDepartDate = (booking: any): string | null => {
  return booking?.depart_date ?? booking?.trips?.depart_date ?? null;
};

const parseSafeISO = (dateValue: string | null | undefined): Date | null => {
  if (!dateValue) return null;
  const parsed = parseISO(dateValue);
  return isValid(parsed) ? parsed : null;
};

export function AgencyMetrics() {
  const [range, setRange] = useState<DateRange>("ytd");
  const navigate = useNavigate();
  const { bookings, loading: bookingsLoading } = useBookings();
  const { data: commissions, isLoading: commissionsLoading } = useCommissions();
  const { data: clients } = useClients();
  const { data: teamProfiles } = useTeamProfiles();
  const { data: adminUserIds } = useAdminUserIds();

  const loading = bookingsLoading || commissionsLoading;

  // Build a map of user_id -> commission_tier for agency split calculation
  const agentTierMap = useMemo(() => {
    const map = new Map<string, CommissionTier | null>();
    if (teamProfiles) {
      teamProfiles.forEach((p) => map.set(p.user_id, p.commission_tier));
    }
    return map;
  }, [teamProfiles]);

  const getAgencyShare = (commissionRevenue: number, userId: string) => {
    // Admin/owner bookings: 100% of the margin is company income
    // (the owner IS the company, so there is no advisor split to pay out).
    if (adminUserIds?.has(userId)) {
      return commissionRevenue;
    }
    const tier = agentTierMap.get(userId);
    return calculateAgencyCommission(commissionRevenue, tier);
  };

  const now = new Date();
  const interval = useMemo(() => {
    if (range === "mtd") {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    return { start: startOfYear(now), end: endOfYear(now) };
  }, [range]);

  // Advisor subscriptions + loan interest earned by the agency in the same window
  const otherIncomeRange = useMemo(
    () => ({
      start: format(interval.start, "yyyy-MM-dd"),
      end: format(new Date(interval.end.getTime() + 86400000), "yyyy-MM-dd"),
    }),
    [interval]
  );
  const { data: otherIncome } = useAgencyOtherIncome(otherIncomeRange);
  const otherIncomeTotal = otherIncome?.total ?? 0;

  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter((b) => {
      if (b.status === "cancelled" || isBookingArchived(b)) return false;
      const parsedDepartDate = parseSafeISO(getBookingDepartDate(b));
      if (!parsedDepartDate) return false;
      return isWithinInterval(parsedDepartDate, interval);
    });
  }, [bookings, interval]);

  const kpis = useMemo(() => {
    const bookingCount = filteredBookings.length;
    const salesVolume = filteredBookings.reduce((s, b) => s + (b.gross_sales || b.total_amount || 0), 0);
    // Phase 4: Use agency_gross_margin (margin engine) with fallback to commission_revenue
    const grossMargin = filteredBookings.reduce((s, b) => s + (b.agency_gross_margin || b.commission_revenue || 0), 0);

    // Agency income: for admin-owned bookings the full margin is company income;
    // for everyone else use the margin engine's agency_margin_amount when available.
    const agencyIncome = filteredBookings.reduce((s, b) => {
      const isAdminOwned = adminUserIds?.has(b.user_id);
      if (isAdminOwned) {
        return s + (b.agency_gross_margin || b.commission_revenue || 0);
      }
      return s + (b.agency_margin_amount || getAgencyShare(b.commission_revenue || 0, b.user_id));
    }, 0);

    return { bookingCount, salesVolume, grossMargin, agencyIncome };
  }, [filteredBookings, agentTierMap, adminUserIds]);

  // Monthly chart data for the selected range
  const chartData = useMemo(() => {
    if (!bookings) return { commission: [], agencyIncome: [], grossSales: [] };

    const monthCount = range === "mtd" ? 1 : 12;
    const months: string[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      months.push(format(startOfMonth(subMonths(now, i)), "yyyy-MM"));
    }

    const initMap = () => Object.fromEntries(months.map((m) => [m, 0]));
    const commMap = initMap();
    const agencyMap = initMap();
    const grossMap = initMap();

    const activeBookings = bookings.filter((b) => b.status !== "cancelled" && !isBookingArchived(b));

    activeBookings.forEach((b) => {
      const parsedDepartDate = parseSafeISO(getBookingDepartDate(b));
      if (!parsedDepartDate) return;

      const key = format(parsedDepartDate, "yyyy-MM");
      if (commMap[key] !== undefined) {
        commMap[key] += b.agency_gross_margin || b.commission_revenue || 0;
        const isAdminOwned = adminUserIds?.has(b.user_id);
        agencyMap[key] += isAdminOwned
          ? (b.agency_gross_margin || b.commission_revenue || 0)
          : (b.agency_margin_amount || getAgencyShare(b.commission_revenue || 0, b.user_id));
        grossMap[key] += b.gross_sales || b.total_amount || 0;
      }
    });

    const toArr = (map: Record<string, number>) =>
      Object.entries(map).map(([m, value]) => ({
        month: format(parseISO(`${m}-01`), "MMM"),
        value,
      }));

    return {
      commission: toArr(commMap),
      agencyIncome: toArr(agencyMap),
      grossSales: toArr(grossMap),
    };
  }, [bookings, range, adminUserIds, agentTierMap]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.[0]) {
      return (
        <div className="rounded-[8px] border border-border bg-popover px-[10px] py-2 text-[12.5px] shadow-lg">
          <p className="font-medium text-foreground">{label}</p>
          <p className="font-semibold text-primary">{fmt(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const MiniBarChart = ({ data, title }: { data: { month: string; value: number }[]; title: string }) => (
    <Panel>
      <PanelHeader title={title} />
      <PanelBody>
        {data.every((d) => d.value === 0) ? (
          <div className="flex h-[160px] items-center justify-center text-[13.5px] text-muted-foreground">
            No data yet
          </div>
        ) : (
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </PanelBody>
    </Panel>
  );

  if (loading) {
    return (
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Agency Metrics
            </span>
          }
        />
        <PanelBody className="space-y-[14px]">
          <KPIGrid>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-[11px]" />
            ))}
          </KPIGrid>
          <Skeleton className="h-[200px] rounded-[11px]" />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.025em] text-foreground">
          <Building2 className="h-4 w-4" />
          At a glance
        </h2>
        <div className="flex overflow-hidden rounded-[8px] border border-border">
          <Button
            variant={range === "mtd" ? "default" : "ghost"}
            size="sm"
            className="rounded-none px-4 text-[13px]"
            onClick={() => setRange("mtd")}
          >
            Month to date
          </Button>
          <Button
            variant={range === "ytd" ? "default" : "ghost"}
            size="sm"
            className="rounded-none px-4 text-[13px]"
            onClick={() => setRange("ytd")}
          >
            Year to date
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPIGrid>
        {[
          { label: "Bookings", value: kpis.bookingCount.toString() },
          { label: "Sales volume", value: fmt(kpis.salesVolume) },
          { label: "Gross margin", value: fmt(kpis.grossMargin) },
          { label: "Agency income", value: fmt(kpis.agencyIncome + otherIncomeTotal) },
          { label: "Other income", value: fmt(otherIncomeTotal) },
        ].map((kpi) => (
          <KPITile key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </KPIGrid>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
        <MiniBarChart data={chartData.commission} title="Gross margin by month" />
        <MiniBarChart data={chartData.agencyIncome} title="Agency retained by month" />
      </div>

      {/* Full Width Gross Sales */}
      <MiniBarChart data={chartData.grossSales} title="Gross sales by month" />

      {/* Ops Alerts */}
      <OpsAlerts />

      {/* Active Authorizations */}
      <ActiveAuthorizations bookings={bookings || []} clients={clients || []} navigate={navigate} />

      {/* Link to full analytics */}
      <Button variant="outline" size="sm" onClick={() => navigate("/analytics")}>
        View all KPIs
      </Button>
    </div>
  );
}

function ActiveAuthorizations({
  bookings,
  clients,
  navigate,
}: {
  bookings: any[];
  clients: any[];
  navigate: (path: string) => void;
}) {
  const upcoming = useMemo(() => {
    const now = new Date();
    const clientMap = new Map(clients.map((c: any) => [c.id, c.name]));

    return bookings
      .map((b) => {
        const departDateRaw = getBookingDepartDate(b);
        const departDate = parseSafeISO(departDateRaw);

        return {
          booking: b,
          departDateRaw,
          departDate,
        };
      })
      .filter(({ booking, departDate }) => {
        if (booking.status === "cancelled" || isBookingArchived(booking)) return false;
        if (!departDate) return false;
        return departDate >= now && (booking.status === "confirmed" || booking.status === "booked");
      })
      .sort(
        (a, b) =>
          (a.departDate?.getTime() ?? Number.POSITIVE_INFINITY) -
          (b.departDate?.getTime() ?? Number.POSITIVE_INFINITY)
      )
      .slice(0, 8)
      .map(({ booking, departDateRaw, departDate }) => ({
        id: booking.id,
        tripId: booking.trip_id,
        client: clientMap.get(booking.client_id) || "Unknown Client",
        destination: booking.destination,
        departDate: departDateRaw,
        departDateLabel: departDate ? format(departDate, "MMM d, yyyy") : "TBD",
        amount: booking.total_amount || 0,
        status: booking.status,
      }));
  }, [bookings, clients]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Active Authorizations
          </span>
        }
        actions={<Badge variant="secondary" className="text-[11.5px]">{upcoming.length} upcoming</Badge>}
      />
      {upcoming.length === 0 ? (
        <EmptyState
          title="No upcoming confirmed bookings"
          message="Confirmed and booked trips will appear here as they're scheduled."
        />
      ) : (
        <div className="table-scroll-mobile">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Client</th>
                <th className="data-table-secondary-col">Destination</th>
                <th className="data-table-secondary-col">Departs</th>
                <th className="data-table-money">Amount</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => item.tripId ? navigate(`/trips/${item.tripId}`) : navigate("/bookings")}
                >
                  <td>
                    {item.client}
                    <span className="block data-table-secondary sm:hidden">{item.destination}</span>
                  </td>
                  <td className="data-table-secondary-col">{item.destination}</td>
                  <td className="data-table-secondary-col">
                    <span className="data-table-secondary">{item.departDateLabel}</span>
                  </td>
                  <td className="data-table-money">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
