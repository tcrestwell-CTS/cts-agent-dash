import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Banknote, FileWarning, ArrowRight, AlertTriangle, FileText, Receipt } from "lucide-react";
import { useBookkeeperAlerts, useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { useEffect } from "react";
import { PeriodLockButton } from "@/components/bookkeeper/PeriodLockButton";
import { BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";

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
      const { data, error } = await (supabase as any)
        .from("stripe_payouts")
        .select("fee_total, amount, net_amount, arrival_date")
        .gte("arrival_date", ytd);
      if (error) throw error;
      const rows = data ?? [];
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

      const [incomeRes, expensesRes, unattribRes] = await Promise.all([
        (supabase as any)
          .from("trip_payments")
          .select("amount, payment_date, status")
          .eq("status", "paid")
          .gte("payment_date", since),
        (supabase as any)
          .from("bookings")
          .select("supplier_paid_amount, supplier_paid_date, supplier_paid_status")
          .eq("supplier_paid_status", "paid")
          .gte("supplier_paid_date", since.slice(0, 10)),
        (supabase as any)
          .from("checkout_payments")
          .select("id", { count: "exact", head: true })
          .eq("payment_type", "unattributed_deposit"),
      ]);

      const mtdIncome = (incomeRes.data ?? []).reduce(
        (s, r: any) => s + Number(r.amount || 0),
        0,
      );
      const mtdExpenses = (expensesRes.data ?? []).reduce(
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
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <BookkeeperBreadcrumb page="Dashboard" />
            <h1 className="text-3xl font-semibold">Bookkeeper Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Read-only financial overview for the current month.
            </p>
          </div>
          <PeriodLockButton year={currentYear} month={currentMonth} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="text-2xl font-bold">{fmt(c.value)}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Stripe Processing Fees
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/bookkeeper/bank-recon">
                  View payouts <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">MTD Fees</div>
                {feesLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                  <div className="text-2xl font-bold">{fmt(fees?.feesMtd ?? 0)}</div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">YTD Fees</div>
                {feesLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                  <div className="text-2xl font-bold">{fmt(fees?.feesYtd ?? 0)}</div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Effective Rate (YTD)</div>
                {feesLoading ? <Skeleton className="h-7 w-24 mt-1" /> : (
                  <div className="text-2xl font-bold">{(fees?.effRate ?? 0).toFixed(2)}%</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  on {fmt(fees?.grossYtd ?? 0)} gross
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {(alerts?.failedSyncs || alerts?.staleUnattributed) ? (
          <Card className="border-amber-500/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {alerts.failedSyncs > 0 && (
                <div className="flex items-center justify-between">
                  <span>{alerts.failedSyncs} failed QBO sync{alerts.failedSyncs === 1 ? "" : "s"} in the last 7 days.</span>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/bookkeeper/qbo-logs">Review</Link>
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
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-amber-500" />
                Unattributed Deposits
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Stripe payments not yet matched to a trip or booking.
              </p>
            </div>
            {!isLoading && (data?.unattributed ?? 0) > 0 && (
              <Badge variant="destructive">{data?.unattributed}</Badge>
            )}
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/bookkeeper/unattributed">
                Review unattributed
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Monthly Financial Packet
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Generate and download the monthly financial packet (P&L, AR/AP aging, bank recon).
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/bookkeeper/packet">
                Generate financial packet
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}