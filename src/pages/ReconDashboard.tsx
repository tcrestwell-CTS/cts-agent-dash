// src/pages/ReconDashboard.tsx
// Executive reconciliation dashboard — overview of all sync health

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
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
import { SemanticStatusPill, type SemanticStatus } from "@/components/patterns/StatusPill";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function StatCard({
  title, value, icon: Icon, tone, onClick, loading,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "warning" | "info" | "destructive" | "success";
  onClick?: () => void;
  loading?: boolean;
}) {
  const toneClass: Record<typeof tone, string> = {
    warning: "bg-warning/15 text-warning",
    info: "bg-info/15 text-info",
    destructive: "bg-destructive/15 text-destructive",
    success: "bg-success/15 text-success",
  };
  return (
    <Panel
      className={`cursor-pointer transition-shadow hover:shadow-md ${onClick ? "hover:border-primary/50" : ""}`}
      onClick={onClick}
    >
      <PanelBody className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[12.5px] text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <p className="text-[22px] font-semibold tabular-nums text-foreground">{value}</p>
          )}
        </div>
      </PanelBody>
    </Panel>
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
      <div className="space-y-[18px]">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.025em] text-foreground">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Reconciliation Agent
            </h1>
            <p className="text-[13.5px] text-muted-foreground">
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
        <div className="grid grid-cols-2 gap-[14px] md:grid-cols-4">
          <StatCard
            title="Needs Review"
            value={stats?.needs_review ?? 0}
            icon={Clock}
            tone="warning"
            loading={isLoading}
            onClick={() => navigate("/recon/matches?status=new")}
          />
          <StatCard
            title="Pending Approvals"
            value={stats?.approvals_pending ?? 0}
            icon={ShieldCheck}
            tone="info"
            loading={isLoading}
            onClick={() => navigate("/recon/approvals")}
          />
          <StatCard
            title="Open Exceptions"
            value={stats?.exceptions_open ?? 0}
            icon={AlertTriangle}
            tone="destructive"
            loading={isLoading}
            onClick={() => navigate("/recon/exceptions")}
          />
          <StatCard
            title="Posted to QBO"
            value={stats?.posted_to_qbo ?? 0}
            icon={CheckCircle2}
            tone="success"
            loading={isLoading}
            onClick={() => navigate("/recon/matches?status=posted_to_qbo")}
          />
        </div>

        {/* Gap Summary */}
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-3">
          {([
            { icon: FileX, tone: "destructive" as const, title: "Missing QBO Invoices", value: stats?.missing_qbo_invoices ?? 0, hint: "CRM bookings with no QBO Invoice", to: "/recon/exceptions?type=missing_qbo_invoice" },
            { icon: Receipt, tone: "warning" as const, title: "Unmatched Stripe Payments", value: stats?.missing_qbo_payments ?? 0, hint: "Stripe payments with no QBO Payment", to: "/recon/exceptions?type=unmatched_stripe_payment" },
            { icon: DollarSign, tone: "warning" as const, title: "Missing QBO Bills", value: stats?.missing_qbo_bills ?? 0, hint: "Supplier costs with no QBO Bill", to: "/recon/exceptions?type=missing_qbo_bill" },
          ]).map(({ icon: Icon, tone, title, value, hint, to }) => (
            <Panel
              key={title}
              className="cursor-pointer transition-shadow hover:border-primary/40 hover:shadow-md"
              onClick={() => navigate(to)}
            >
              <PanelHeader
                title={
                  <span className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${tone === "destructive" ? "text-destructive" : "text-warning"}`} />
                    {title}
                  </span>
                }
              />
              <PanelBody>
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className={`text-[28px] font-semibold tabular-nums ${tone === "destructive" ? "text-destructive" : "text-warning"}`}>
                    {value}
                  </p>
                )}
                <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
              </PanelBody>
            </Panel>
          ))}
        </div>

        {/* Quick Nav */}
        <SyncStatusPanel />

        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
          <Panel
            className="cursor-pointer transition-shadow hover:border-primary/40 hover:shadow-md"
            onClick={() => navigate("/recon/matches")}
          >
            <PanelHeader
              title="Match Center"
              subtitle="Review confidence-scored matches between CRM, Stripe, and QBO"
            />
            <PanelBody>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{stats?.total_matches ?? 0} total matches</Badge>
                <SemanticStatusPill status="success" label={`${stats?.auto_matched ?? 0} auto-matched`} />
                {(stats?.needs_review ?? 0) > 0 && (
                  <SemanticStatusPill status="warning" label={`${stats.needs_review} need review`} />
                )}
              </div>
            </PanelBody>
          </Panel>

          <Panel
            className="cursor-pointer transition-shadow hover:border-primary/40 hover:shadow-md"
            onClick={() => navigate("/recon/payouts")}
          >
            <PanelHeader
              title="Stripe Payouts"
              subtitle="Reconcile Stripe deposits to QBO bank deposits, with fee breakdown"
            />
            <PanelBody>
              <div className="flex gap-2">
                {(stats?.unreconciled_stripe_payouts ?? 0) > 0 ? (
                  <SemanticStatusPill status="destructive" label={`${stats?.unreconciled_stripe_payouts} unreconciled payouts`} />
                ) : (
                  <SemanticStatusPill status="success" label="All payouts reconciled" />
                )}
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </DashboardLayout>
  );
}
