import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { KPITile, KPIGrid } from "@/components/patterns/KPITile";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { DollarSign, TrendingUp, Banknote, FileWarning, ArrowRight, AlertTriangle, FileText, Receipt } from "lucide-react";
import { useBookkeeperAlerts, useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { useEffect } from "react";
import { PeriodLockButton } from "@/components/bookkeeper/PeriodLockButton";
import { BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";
import { StripeFeesTrendChart } from "@/components/bookkeeper/StripeFeesTrendChart";

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function startOfMonthDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function startOfYearDate() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

function useStripeFeeKpis() {
  return useQuery({
    queryKey: ["bookkeeper-stripe-fees"],
    queryFn: async () => {
      const mtd = startOfMonthDate();
      const ytd = startOfYearDate();
      const rows = await fetchAllRows<any>((from, to) =>
        (supabase as any)
          .from("stripe_payouts")
          .select("fee_total, amount, net_amount, arrival_date")
          .gte("arrival_date", ytd)
          .order("arrival_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
      let feesMtd = 0, feesYtd = 0, grossYtd = 0;
      for (const r of rows) {
        const fee = Number(r.fee_total || 0);
        feesYtd += fee;
        grossYtd += Number(r.amount || 0);
        if (r.arrival_date && r.arrival_date >= mtd) feesMtd += fee;
      }
      const effRate = grossYtd > 0 ? (feesYtd / grossYtd) * 100 : 0;
      return { feesMtd, feesYtd, grossYtd, effRate };
    },
  });
}

function useBookkeeperKpis() {
  return useQuery({
    queryKey: ["bookkeeper-kpis"],
    queryFn: async () => {
      const since = startOfMonthISO();

      const [incomeRows, expenseRows, unattribRes] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          (supabase as any)
            .from("trip_payments")
            .select("amount, payment_date, status")
            .eq("status", "paid")
            .gte("payment_date", since)
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchAllRows<any>((from, to) =>
          (supabase as any)
            .from("bookings")
            .select("supplier_paid_amount, supplier_paid_date, supplier_paid_status")
            .eq("supplier_paid_status", "paid")
            .gte("supplier_paid_date", since.slice(0, 10))
            .order("id", { ascending: true })
            .range(from, to),
        ),
        (supabase as any)
          .from("checkout_payments")
          .select("id", { count: "exact", head: true })
          .eq("payment_type", "unattributed_deposit"),
      ]);
      if (unattribRes.error) throw unattribRes.error;

      const mtdIncome = incomeRows.reduce(
        (s, r: any) => s + Number(r.amount || 0),
        0,
      );
      const mtdExpenses = expenseRows.reduce(
        (s, r: any) => s + Number(r.supplier_paid_amount || 0),
        0,
      );
      return {
        mtdIncome,
        mtdExpenses,
        mtdNet: mtdIncome - mtdExpenses,
        unattributed: unattribRes.count ?? 0,
      };
    },
  });
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function BookkeeperDashboard() {
  const { data, isLoading } = useBookkeeperKpis();
  const { data: fees, isLoading: feesLoading } = useStripeFeeKpis();
  const { data: alerts } = useBookkeeperAlerts();
  const logAction = useLogBookkeeperAction();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  useEffect(() => {
    logAction("view", "bookkeeper_dashboard");
  }, [logAction]);

  const cards = [
    { label: "MTD Income", value: data?.mtdIncome ?? 0, icon: DollarSign },
    { label: "MTD Expenses", value: data?.mtdExpenses ?? 0, icon: Banknote },
    { label: "MTD Net", value: data?.mtdNet ?? 0, icon: TrendingUp },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <BookkeeperBreadcrumb page="Dashboard" />
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Bookkeeper Dashboard</h1>
            <p className="text-[13.5px] text-muted-foreground">
              Read-only financial overview for the current month.
            </p>
          </div>
          <PeriodLockButton year={currentYear} month={currentMonth} />
        </div>

        <KPIGrid className="sm:grid-cols-3 lg:grid-cols-3">
          {cards.map((c) => (
            <KPITile
              key={c.label}
              label={c.label}
              value={isLoading ? <Skeleton className="h-7 w-24" /> : fmt(c.value)}
            />
          ))}
        </KPIGrid>

        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Stripe Processing Fees
              </span>
            }
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link to="/bookkeeper/bank-recon">
                  View payouts <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            }
          />
          <PanelBody>
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">MTD Fees</div>
                {feesLoading ? <Skeleton className="mt-1.5 h-7 w-24" /> : (
                  <div className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{fmt(fees?.feesMtd ?? 0)}</div>
                )}
              </div>
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">YTD Fees</div>
                {feesLoading ? <Skeleton className="mt-1.5 h-7 w-24" /> : (
                  <div className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{fmt(fees?.feesYtd ?? 0)}</div>
                )}
              </div>
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Effective Rate (YTD)</div>
                {feesLoading ? <Skeleton className="mt-1.5 h-7 w-24" /> : (
                  <div className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{(fees?.effRate ?? 0).toFixed(2)}%</div>
                )}
                <div className="mt-0.5 text-[12px] text-muted-foreground">
                  on {fmt(fees?.grossYtd ?? 0)} gross
                </div>
              </div>
            </div>
          </PanelBody>
        </Panel>

        <StripeFeesTrendChart />

        {(alerts?.failedSyncs || alerts?.staleUnattributed) ? (
          <Panel className="border-warning/40">
            <PanelHeader
              title={
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Alerts
                </span>
              }
            />
            <PanelBody className="space-y-2 text-[13.5px]">
              {alerts.failedSyncs > 0 && (
                <div className="flex items-center justify-between">
                  <span>{alerts.failedSyncs} failed QBO sync{alerts.failedSyncs === 1 ? "" : "s"} in the last 7 days.</span>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/qbo-payment-sync">Review</Link>
                  </Button>
                </div>
              )}
              {alerts.staleUnattributed > 0 && (
                <div className="flex items-center justify-between">
                  <span>{alerts.staleUnattributed} unattributed deposit{alerts.staleUnattributed === 1 ? "" : "s"} older than 7 days.</span>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/bookkeeper/unattributed">Review</Link>
                  </Button>
                </div>
              )}
            </PanelBody>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-warning" />
                Unattributed Deposits
              </span>
            }
            subtitle="Stripe payments not yet matched to a trip or booking."
            actions={
              !isLoading && (data?.unattributed ?? 0) > 0 ? (
                <Badge variant="destructive">{data?.unattributed}</Badge>
              ) : undefined
            }
          />
          <PanelBody>
            <Button asChild variant="outline">
              <Link to="/bookkeeper/unattributed">
                Review unattributed
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Monthly Financial Packet
              </span>
            }
            subtitle="Generate and download the monthly financial packet (P&L, AR/AP aging, bank recon)."
          />
          <PanelBody>
            <Button asChild>
              <Link to="/bookkeeper/packet">
                Generate financial packet
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </PanelBody>
        </Panel>
      </div>
    </DashboardLayout>
  );
}