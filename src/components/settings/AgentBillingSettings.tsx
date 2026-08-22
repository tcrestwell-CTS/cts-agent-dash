import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, RefreshCw, Loader2, Banknote } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import {
  useMyAgentSubscription,
  useUpdateBillingPaymentMethod,
  useSyncBillingPaymentMethod,
} from "@/hooks/useAgentSubscription";
import { useAgentSubscriptionPayments } from "@/hooks/useAgencyOtherIncome";
import { AgentPayoutSettings } from "@/components/settings/AgentPayoutSettings";
import { useAuth } from "@/contexts/AuthContext";
import { getTierConfig } from "@/lib/commissionTiers";
import { usePermissions } from "@/hooks/usePermissions";
import { useEarningsLabel } from "@/hooks/useEarningsLabel";

const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

const prettyDate = (value: string | null | undefined) => {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? format(d, "MMM d, yyyy") : null;
};

const intervalLabel = (interval: string) => {
  switch (interval) {
    case "yearly":
    case "year":
      return "per year";
    case "weekly":
      return "per week";
    case "one_time":
      return "one time";
    default:
      return "per month";
  }
};

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "active") return "default";
  if (status === "past_due" || status === "cancelled" || status === "canceled") return "destructive";
  return "secondary";
};

interface Props {
  commissionTier?: string | null;
  profileLoading?: boolean;
}

export function AgentBillingSettings({ commissionTier, profileLoading }: Props) {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const earnings = useEarningsLabel();
  const { data: subscription, isLoading } = useMyAgentSubscription();
  const { data: payments } = useAgentSubscriptionPayments();
  const updateMethod = useUpdateBillingPaymentMethod();
  const syncMethod = useSyncBillingPaymentMethod();

  const myPayments = useMemo(
    () => (payments ?? []).filter((p) => p.agent_user_id === user?.id).slice(0, 12),
    [payments, user?.id],
  );

  const tier = getTierConfig((commissionTier as any) ?? "tier_1");
  const cardLabel = subscription?.payment_method_last4
    ? `${subscription.payment_method_brand ? subscription.payment_method_brand.toUpperCase() : "Card"} •••• ${subscription.payment_method_last4}${
        subscription.payment_method_exp ? ` — exp ${subscription.payment_method_exp}` : ""
      }`
    : "No card on file";

  return (
    <div className="space-y-6">
      {/* ── Subscription ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Your Subscription
          </CardTitle>
          <CardDescription>The plan you signed up for and how you're billed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading || profileLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : subscription ? (
            <>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-card-foreground">{subscription.plan_name}</p>
                      <Badge variant={statusVariant(subscription.status)} className="text-xs capitalize">
                        {subscription.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {subscription.amount > 0
                        ? `${money(subscription.amount)} ${intervalLabel(subscription.billing_interval)}`
                        : "No subscription fee"}
                      {subscription.plan_description ? ` • ${subscription.plan_description}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {prettyDate(subscription.started_on) && (
                      <p>Member since {prettyDate(subscription.started_on)}</p>
                    )}
                    {prettyDate(subscription.next_billing_date) && (
                      <p>Next charge {prettyDate(subscription.next_billing_date)}</p>
                    )}
                  </div>
                </div>
              </div>

              {!isAdmin && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm text-muted-foreground">Your {earnings.singularLower} split</p>
                    <p className="text-xl font-semibold text-card-foreground">{tier.agentSplit}%</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm text-muted-foreground">Agency share</p>
                    <p className="text-xl font-semibold text-card-foreground">{tier.agencySplit}%</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4">
              <p className="font-medium text-card-foreground">
                {isAdmin ? "Owner / Agency Plan" : `${tier.label} Plan`}
              </p>
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? "No subscription fee • 100% agency margin"
                  : `No subscription on file • ${tier.description}`}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                If you signed up for a paid plan and it isn't showing here, add your card below and
                refresh — or contact your agency admin.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Payment method ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Method
          </CardTitle>
          <CardDescription>The card charged for your subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-card-foreground">{cardLabel}</p>
              <p className="text-sm text-muted-foreground">
                Card details are stored securely with our payment processor — never in this app.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMethod.mutate()}
                disabled={syncMethod.isPending}
              >
                {syncMethod.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
              <Button size="sm" onClick={() => updateMethod.mutate()} disabled={updateMethod.isPending}>
                {updateMethod.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {subscription?.payment_method_last4 ? "Update card" : "Add card"}
              </Button>
            </div>
          </div>

          {myPayments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-card-foreground">Recent subscription charges</h4>
              <div className="table-scroll-mobile">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th className="data-table-money">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPayments.map((p) => (
                      <tr key={p.id}>
                        <td>{prettyDate(p.payment_date) ?? "—"}</td>
                        <td>{p.plan_name || "Advisor subscription"}</td>
                        <td className="capitalize">{p.status}</td>
                        <td className="data-table-money">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Payout details ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Banknote className="h-4 w-4" />
          Payout Information
        </h3>
        <p className="text-sm text-muted-foreground">
          Where the agency sends your {earnings.pluralLower ?? "commission"} payments.
        </p>
        <AgentPayoutSettings />
      </div>
    </div>
  );
}
