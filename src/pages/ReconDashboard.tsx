// src/pages/ReconDashboard.tsx
// Executive reconciliation dashboard — overview of all sync health

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock,
  DollarSign, ArrowRightLeft, Receipt, FileX, ShieldCheck,
  Loader2, Play, Database,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useReconStats, useRunRecon, useRunQBOSync } from "@/hooks/useRecon";
import { useNavigate } from "react-router-dom";
import { SyncStatusPanel } from "@/components/recon/SyncStatusPanel";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function StatCard({
  title, value, icon: Icon, color, onClick, loading,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${onClick ? "hover:border-primary/50" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReconDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading, refetch } = useReconStats();
  const runRecon = useRunRecon();
  const runSync = useRunQBOSync();
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const handleRunRecon = async () => {
    await runRecon.mutateAsync(undefined);
    setLastRun(new Date());
    refetch();
  };

  const handleRunSync = async () => {
    await runSync.mutateAsync(undefined);
    refetch();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
              Reconciliation Agent
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              CRM ↔ QuickBooks Online sync status
              {lastRun && (
                <span className="ml-2 text-xs">
                  · Last run: {format(lastRun, "h:mm a")}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunSync}
              disabled={runSync.isPending}
            >
              {runSync.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Sync QBO Cache
            </Button>
            <Button
              size="sm"
              onClick={handleRunRecon}
              disabled={runRecon.isPending}
            >
              {runRecon.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Reconciliation
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Needs Review"
            value={stats?.needs_review ?? 0}
            icon={Clock}
            color="bg-yellow-500"
            loading={isLoading}
            onClick={() => navigate("/recon/matches?status=new")}
          />
          <StatCard
            title="Pending Approvals"
            value={stats?.approvals_pending ?? 0}
            icon={ShieldCheck}
            color="bg-blue-600"
            loading={isLoading}
            onClick={() => navigate("/recon/approvals")}
          />
          <StatCard
            title="Open Exceptions"
            value={stats?.exceptions_open ?? 0}
            icon={AlertTriangle}
            color="bg-red-500"
            loading={isLoading}
            onClick={() => navigate("/recon/exceptions")}
          />
          <StatCard
            title="Posted to QBO"
            value={stats?.posted_to_qbo ?? 0}
            icon={CheckCircle2}
            color="bg-green-600"
            loading={isLoading}
            onClick={() => navigate("/recon/matches?status=posted_to_qbo")}
          />
        </div>

        {/* Gap Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md hover:border-red-200 transition-shadow"
            onClick={() => navigate("/recon/exceptions?type=missing_qbo_invoice")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileX className="h-4 w-4 text-red-500" />
                Missing QBO Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-3xl font-bold text-red-600">
                  {stats?.missing_qbo_invoices ?? 0}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                CRM bookings with no QBO Invoice
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md hover:border-orange-200 transition-shadow"
            onClick={() => navigate("/recon/exceptions?type=unmatched_stripe_payment")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-orange-500" />
                Unmatched Stripe Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-3xl font-bold text-orange-600">
                  {stats?.missing_qbo_payments ?? 0}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Stripe payments with no QBO Payment
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md hover:border-yellow-200 transition-shadow"
            onClick={() => navigate("/recon/exceptions?type=missing_qbo_bill")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-yellow-600" />
                Missing QBO Bills
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-3xl font-bold text-yellow-700">
                  {stats?.missing_qbo_bills ?? 0}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Supplier costs with no QBO Bill
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Nav */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/recon/matches")}
          >
            <CardHeader>
              <CardTitle className="text-base">Match Center</CardTitle>
              <CardDescription>
                Review confidence-scored matches between CRM, Stripe, and QBO
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">
                  {stats?.total_matches ?? 0} total matches
                </Badge>
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  {stats?.auto_matched ?? 0} auto-matched
                </Badge>
                {(stats?.needs_review ?? 0) > 0 && (
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    {stats.needs_review} need review
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/recon/payouts")}
          >
            <CardHeader>
              <CardTitle className="text-base">Stripe Payouts</CardTitle>
              <CardDescription>
                Reconcile Stripe deposits to QBO bank deposits, with fee breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {(stats?.unreconciled_stripe_payouts ?? 0) > 0 ? (
                  <Badge className="bg-red-100 text-red-800 border-red-200">
                    {stats?.unreconciled_stripe_payouts} unreconciled payouts
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    All payouts reconciled
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
