import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";
import {
  useSaveAgentSubscriptionPayment,
  type AgentSubscriptionPayment,
} from "@/hooks/useAgencyOtherIncome";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment?: AgentSubscriptionPayment | null;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function AgentSubscriptionDialog({ open, onOpenChange, payment }: Props) {
  const { data: teamProfiles } = useTeamProfiles();
  const save = useSaveAgentSubscriptionPayment();

  const [agentUserId, setAgentUserId] = useState("");
  const [planName, setPlanName] = useState("Advisor subscription");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [stripePi, setStripePi] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setAgentUserId(payment?.agent_user_id ?? "");
    setPlanName(payment?.plan_name ?? "Advisor subscription");
    setAmount(payment ? String(payment.amount ?? "") : "");
    setPaymentDate(payment?.payment_date ?? todayISO());
    setPeriodStart(payment?.period_start ?? "");
    setPeriodEnd(payment?.period_end ?? "");
    setPaymentMethod(payment?.payment_method ?? "stripe");
    setStripePi(payment?.stripe_payment_intent_id ?? "");
    setNotes(payment?.notes ?? "");
  }, [open, payment]);

  const canSave = !!agentUserId && Number(amount) > 0 && !!paymentDate;

  const handleSave = async () => {
    await save.mutateAsync({
      ...(payment?.id ? { id: payment.id } : {}),
      agent_user_id: agentUserId,
      plan_name: planName || null,
      amount: Number(amount),
      payment_date: paymentDate,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      payment_method: paymentMethod,
      status: "paid",
      stripe_payment_intent_id: stripePi || null,
      notes: notes || null,
    } as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{payment ? "Edit subscription payment" : "Log advisor subscription payment"}</DialogTitle>
          <DialogDescription>
            Recorded as agency income for the payment date below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Advisor</Label>
            <Select value={agentUserId} onValueChange={setAgentUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select advisor" />
              </SelectTrigger>
              <SelectContent>
                {(teamProfiles ?? []).map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name || "Unnamed advisor"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Advisor subscription" />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="49.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Paid on</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Period start</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Period end</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="ach">ACH / bank transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Stripe payment ID</Label>
              <Input value={stripePi} onChange={(e) => setStripePi(e.target.value)} placeholder="pi_..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
