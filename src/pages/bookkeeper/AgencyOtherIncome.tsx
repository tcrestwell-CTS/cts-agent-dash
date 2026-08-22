import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Table, TableBody, TableCell, TableHeader } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Plus, Repeat, Landmark, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/csvExport";
import {
  BookkeeperHeader,
  PeriodPicker,
  monthBounds,
  EmptyState,
  TableBodySkeletonRows,
  MoneyCell,
} from "@/components/bookkeeper/shared";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { KPIGrid, KPITile } from "@/components/patterns/KPITile";
import { parseLocalDate } from "@/lib/utils";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";
import {
  useAgencyOtherIncome,
  useAgentSubscriptionPayments,
  useDeleteAgentSubscriptionPayment,
  type AgentSubscriptionPayment,
} from "@/hooks/useAgencyOtherIncome";
import { AgentSubscriptionDialog } from "@/components/bookkeeper/AgentSubscriptionDialog";
import { AdvisorPlansPanel } from "@/components/bookkeeper/AdvisorPlansPanel";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function AgencyOtherIncome() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [scope, setScope] = useState<"month" | "ytd">("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgentSubscriptionPayment | null>(null);

  const range = useMemo(() => {
    if (scope === "ytd") {
      const m = monthBounds(year, month);
      return { start: `${year}-01-01`, end: m.end };
    }
    return monthBounds(year, month);
  }, [year, month, scope]);
  const { data, isLoading } = useAgencyOtherIncome(range);
  const { data: subscriptions } = useAgentSubscriptionPayments(range);
  const { data: teamProfiles } = useTeamProfiles();
  const deleteSub = useDeleteAgentSubscriptionPayment();

  const rows = data?.rows ?? [];
  const advisorName = (userId: string) =>
    teamProfiles?.find((p) => p.user_id === userId)?.full_name || "Advisor";

  const exportCsv = () =>
    exportToCSV(
      rows.map((r) => ({
        date: r.date,
        source: r.source === "agent_subscription" ? "Advisor subscription" : "Loan interest",
        description: r.label,
        income: r.amount.toFixed(2),
        principal_repaid: r.principal.toFixed(2),
        reference: r.reference ?? "",
      })),
      scope === "ytd"
        ? `agency-other-income-${year}-ytd`
        : `agency-other-income-${year}-${String(month).padStart(2, "0")}`,
    );


  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <BookkeeperHeader
          title="Agency Other Income"
          description="Advisor subscription fees and loan interest earned by the agency."
          year={year}
          month={month}
          actions={
            <>
              <ToggleGroup
                type="single"
                size="sm"
                value={scope}
                onValueChange={(v) => v && setScope(v as "month" | "ytd")}
              >
                <ToggleGroupItem value="month" className="text-[13px]">Month</ToggleGroupItem>
                <ToggleGroupItem value="ytd" className="text-[13px]">YTD</ToggleGroupItem>
              </ToggleGroup>
              <PeriodPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

              <Button variant="outline" size="sm" className="text-[13px]" onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
              <Button size="sm" className="text-[13px]" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Log subscription
              </Button>
            </>
          }
        />

        <KPIGrid>
          <KPITile label="Advisor subscriptions" value={fmt(data?.subscriptionTotal ?? 0)} />
          <KPITile label="Loan interest income" value={fmt(data?.loanInterestTotal ?? 0)} />
          <KPITile label="Total other income" value={fmt(data?.total ?? 0)} />
          <KPITile label="Loan principal repaid" value={fmt(data?.loanPrincipalTotal ?? 0)} />
        </KPIGrid>

        <Panel>
          <PanelHeader
            title="Other income transactions"
            actions={
              <div className="text-[12.5px] text-muted-foreground">
                Total: <span className="text-[13px] font-semibold text-foreground tabular-nums">{fmt(data?.total ?? 0)}</span>
              </div>
            }
          />
          <PanelBody>
            <Table>
              <TableHeader>
                <tr className="border-b">
                  <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Date</th>
                  <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Source</th>
                  <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Description</th>
                  <th className="h-10 px-2 text-right text-[12.5px] font-medium text-muted-foreground">Income</th>
                  <th className="h-10 px-2 text-right text-[12.5px] font-medium text-muted-foreground">Principal</th>
                </tr>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableBodySkeletonRows rows={6} cols={5} />
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b transition-colors hover:bg-muted/50">
                      <TableCell className="text-[14px]">
                        {r.date ? format(parseLocalDate(r.date), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 rounded-[20px] border border-border px-[9px] py-[2px] text-[11.5px] font-medium text-muted-foreground">
                          {r.source === "agent_subscription" ? (
                            <><Repeat className="h-3 w-3" /> Subscription</>
                          ) : (
                            <><Landmark className="h-3 w-3" /> Loan interest</>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-sm truncate text-[14px]">{r.label}</TableCell>
                      <MoneyCell value={r.amount} bold />
                      <MoneyCell value={r.principal} />
                    </tr>
                  ))
                )}
              </TableBody>
            </Table>
            {!isLoading && rows.length === 0 && (
              <EmptyState
                icon={Repeat}
                title="No other income for this period"
                description="Log an advisor subscription payment or select a different month."
              />
            )}
          </PanelBody>
        </Panel>

        <AdvisorPlansPanel />

        <Panel>
          <PanelHeader title="Advisor subscription payments" />
          <PanelBody>
            {(subscriptions ?? []).length === 0 ? (
              <EmptyState
                icon={Repeat}
                title="No subscription payments logged"
                description="Use “Log subscription” to record advisor platform fees for this month."
              />
            ) : (
              <Table>
                <TableHeader>
                  <tr className="border-b">
                    <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Advisor</th>
                    <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Plan</th>
                    <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Paid</th>
                    <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Method</th>
                    <th className="h-10 px-2 text-right text-[12.5px] font-medium text-muted-foreground">Amount</th>
                    <th className="h-10 px-2 text-right text-[12.5px] font-medium text-muted-foreground">Actions</th>
                  </tr>
                </TableHeader>
                <TableBody>
                  {(subscriptions ?? []).map((s) => (
                    <tr key={s.id} className="border-b transition-colors hover:bg-muted/50">
                      <TableCell className="text-[14px]">{advisorName(s.agent_user_id)}</TableCell>
                      <TableCell className="text-[14px] text-muted-foreground">{s.plan_name || "—"}</TableCell>
                      <TableCell className="text-[14px]">
                        {s.payment_date ? format(parseLocalDate(s.payment_date), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-[14px] capitalize text-muted-foreground">{s.payment_method}</TableCell>
                      <MoneyCell value={Number(s.amount || 0)} bold />
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSub.mutate(s.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
      </div>

      <AgentSubscriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payment={editing}
      />
    </DashboardLayout>
  );
}
