import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHeader } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { EmptyState, MoneyCell } from "@/components/bookkeeper/shared";
import { Pencil, Plus, Repeat } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";
import {
  useAgentSubscriptions,
  useUpsertAgentSubscription,
  type AgentSubscription,
} from "@/hooks/useAgentSubscription";

const BILLING_INTERVALS = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One time" },
];

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "past_due", label: "Past due" },
  { value: "cancelled", label: "Cancelled" },
];

export function AdvisorPlansPanel() {
  const { data: subscriptions } = useAgentSubscriptions();
  const { data: teamProfiles } = useTeamProfiles();
  const upsert = useUpsertAgentSubscription();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    agent_user_id: "",
    plan_name: "Advisor Plan",
    plan_description: "",
    amount: "0",
    billing_interval: "monthly",
    status: "active",
    started_on: "",
    next_billing_date: "",
  });

  const advisorName = (userId: string) =>
    teamProfiles?.find((p) => p.user_id === userId)?.full_name || "Advisor";

  const rows = useMemo(() => subscriptions ?? [], [subscriptions]);

  const openNew = () => {
    setForm({
      agent_user_id: "",
      plan_name: "Advisor Plan",
      plan_description: "",
      amount: "0",
      billing_interval: "monthly",
      status: "active",
      started_on: "",
      next_billing_date: "",
    });
    setOpen(true);
  };

  const openEdit = (s: AgentSubscription) => {
    setForm({
      agent_user_id: s.agent_user_id,
      plan_name: s.plan_name ?? "Advisor Plan",
      plan_description: s.plan_description ?? "",
      amount: String(s.amount ?? 0),
      billing_interval: s.billing_interval ?? "monthly",
      status: s.status ?? "active",
      started_on: s.started_on ?? "",
      next_billing_date: s.next_billing_date ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.agent_user_id) return;
    await upsert.mutateAsync({
      agent_user_id: form.agent_user_id,
      plan_name: form.plan_name || "Advisor Plan",
      plan_description: form.plan_description || null,
      amount: Number(form.amount) || 0,
      billing_interval: form.billing_interval,
      status: form.status,
      started_on: form.started_on || null,
      next_billing_date: form.next_billing_date || null,
    } as any);
    setOpen(false);
  };

  return (
    <>
      <Panel>
        <PanelHeader
          title="Advisor plans"
          actions={
            <Button size="sm" variant="outline" className="text-[13px]" onClick={openNew}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Set a plan
            </Button>
          }
        />
        <PanelBody>
          {rows.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No advisor plans set"
              description="Set each advisor's signed-up plan so it shows on their Billing & Subscription tab."
            />
          ) : (
            <Table>
              <TableHeader>
                <tr className="border-b">
                  <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Advisor</th>
                  <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Plan</th>
                  <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Status</th>
                  <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Next charge</th>
                  <th className="h-10 px-2 text-left text-[12.5px] font-medium text-muted-foreground">Card</th>
                  <th className="h-10 px-2 text-right text-[12.5px] font-medium text-muted-foreground">Amount</th>
                  <th className="h-10 px-2 text-right text-[12.5px] font-medium text-muted-foreground">Actions</th>
                </tr>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell className="text-[14px]">{advisorName(s.agent_user_id)}</TableCell>
                    <TableCell className="text-[14px] text-muted-foreground">
                      {s.plan_name}
                      <span className="block text-[12.5px] capitalize">{s.billing_interval.replace("_", " ")}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11.5px] capitalize">
                        {(s.status ?? "").replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[14px] text-muted-foreground">
                      {s.next_billing_date ? format(parseLocalDate(s.next_billing_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-[14px] text-muted-foreground">
                      {s.payment_method_last4 ? `•••• ${s.payment_method_last4}` : "Not on file"}
                    </TableCell>
                    <MoneyCell value={Number(s.amount || 0)} bold />
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </tr>
                ))}
              </TableBody>
            </Table>
          )}
        </PanelBody>
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Advisor plan</DialogTitle>
            <DialogDescription>
              This is what the advisor sees under Settings → Billing & Subscription.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Advisor</Label>
              <Select
                value={form.agent_user_id}
                onValueChange={(v) => setForm((f) => ({ ...f, agent_user_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an advisor" />
                </SelectTrigger>
                <SelectContent>
                  {(teamProfiles ?? []).map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || "Advisor"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Plan name</Label>
                <Input
                  value={form.plan_name}
                  onChange={(e) => setForm((f) => ({ ...f, plan_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Billing interval</Label>
                <Select
                  value={form.billing_interval}
                  onValueChange={(v) => setForm((f) => ({ ...f, billing_interval: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_INTERVALS.map((i) => (
                      <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Signed up on</Label>
                <Input
                  type="date"
                  value={form.started_on}
                  onChange={(e) => setForm((f) => ({ ...f, started_on: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Next charge</Label>
                <Input
                  type="date"
                  value={form.next_billing_date}
                  onChange={(e) => setForm((f) => ({ ...f, next_billing_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Plan description (optional)</Label>
              <Input
                placeholder="e.g. Includes CRM, storefront and training access"
                value={form.plan_description}
                onChange={(e) => setForm((f) => ({ ...f, plan_description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.agent_user_id || upsert.isPending}>
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
