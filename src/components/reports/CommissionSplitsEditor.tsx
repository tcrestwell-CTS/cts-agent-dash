import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { getTierConfig, CommissionTier } from "@/lib/commissionTiers";
import {
  SplitDraft,
  SplitRole,
  usePayoutDraft,
  useMentorRules,
} from "@/hooks/useCommissionSplits";

interface AgentOption {
  user_id: string;
  full_name: string | null;
}

interface Props {
  commissionId: string;
  bookingId: string;
  amount: number;
  agent: { user_id: string; full_name: string | null; commission_tier: string | null } | null;
  paidDate: string | null;
  agents: AgentOption[];
  /** Admin only. When false, split values render as read-only text. */
  editable: boolean;
  /** Admin + bookkeeper. When false, no Stage/Discard/Confirm controls render at all. */
  canSettle: boolean;
  onClose?: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function seedDefaults(
  amount: number,
  agent: Props["agent"],
  mentorRules: ReturnType<typeof useMentorRules>["data"],
): SplitDraft[] {
  const tier = (agent?.commission_tier || "tier_1") as CommissionTier;
  const agentSplit = getTierConfig(tier).agentSplit; // 0..1
  const rule = mentorRules?.find((r) => r.mentee_user_id === agent?.user_id && r.split_percent > 0);

  const agentGross = amount * agentSplit; // agent's earned pool before mentor cut
  const mentorPct = rule ? Number(rule.split_percent) : 0;
  const mentorAmount = mentorPct > 0 ? (agentGross * mentorPct) / 100 : 0;
  const agentAmount = agentGross - mentorAmount;
  const houseAmount = amount - agentGross;

  const round = (n: number) => Math.round(n * 100) / 100;

  const drafts: SplitDraft[] = [
    {
      recipient_user_id: agent?.user_id ?? null,
      role: "agent",
      percent: amount ? round((agentAmount / amount) * 100) : 0,
      amount: round(agentAmount),
      notes: null,
    },
  ];
  if (rule && mentorAmount > 0) {
    drafts.push({
      recipient_user_id: rule.mentor_user_id,
      role: "mentor",
      percent: amount ? round((mentorAmount / amount) * 100) : 0,
      amount: round(mentorAmount),
      notes: `Mentor split (${mentorPct}% of agent share)`,
    });
  }
  if (houseAmount > 0.001) {
    drafts.push({
      recipient_user_id: null,
      role: "house",
      percent: amount ? round((houseAmount / amount) * 100) : 0,
      amount: round(houseAmount),
      notes: null,
    });
  }
  return drafts;
}

export function CommissionSplitsEditor({
  commissionId,
  bookingId,
  amount,
  agent,
  paidDate,
  agents,
  editable,
  canSettle,
  onClose,
}: Props) {
  const { drafts: allDrafts, stage, unstage } = usePayoutDraft();
  const { data: mentorRules } = useMentorRules();

  const existing = allDrafts[commissionId];

  const [splits, setSplits] = useState<SplitDraft[]>(
    existing?.splits ?? seedDefaults(amount, agent, mentorRules ?? [])
  );
  const [receivedDate, setReceivedDate] = useState<string>(
    existing?.paid_date ?? paidDate ?? new Date().toISOString().slice(0, 10)
  );

  // Re-seed when mentor rules load if we had no draft yet
  useEffect(() => {
    if (existing || !mentorRules) return;
    setSplits(seedDefaults(amount, agent, mentorRules));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorRules]);

  const totalAmount = useMemo(
    () => splits.reduce((s, x) => s + Number(x.amount || 0), 0),
    [splits]
  );
  const totalPercent = useMemo(
    () => splits.reduce((s, x) => s + Number(x.percent || 0), 0),
    [splits]
  );
  const balanced = Math.abs(totalAmount - amount) < 0.01;

  const updateSplit = (idx: number, patch: Partial<SplitDraft>) => {
    setSplits((old) => old.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const changePercent = (idx: number, pct: number) => {
    const clean = Math.max(0, Math.min(100, Number(pct) || 0));
    updateSplit(idx, {
      percent: clean,
      amount: Math.round(((amount * clean) / 100) * 100) / 100,
    });
  };
  const changeAmount = (idx: number, amt: number) => {
    const clean = Math.max(0, Number(amt) || 0);
    updateSplit(idx, {
      amount: clean,
      percent: amount ? Math.round((clean / amount) * 10000) / 100 : 0,
    });
  };
  const addSplit = () => {
    const remaining = Math.max(0, amount - totalAmount);
    setSplits((s) => [
      ...s,
      {
        recipient_user_id: null,
        role: "custom",
        percent: amount ? Math.round((remaining / amount) * 10000) / 100 : 0,
        amount: Math.round(remaining * 100) / 100,
        notes: null,
      },
    ]);
  };
  const removeSplit = (idx: number) => setSplits((s) => s.filter((_, i) => i !== idx));

  const handleStage = () => {
    stage({
      commission_id: commissionId,
      booking_id: bookingId,
      paid_date: receivedDate,
      total: amount,
      splits,
    });
    onClose?.();
  };
  const handleDiscard = () => {
    unstage(commissionId);
    onClose?.();
  };

  return (
    <div className="bg-muted/20 border-y border-border px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm">
          <span className="font-semibold">Splits · </span>
          <span className="text-muted-foreground">
            Commission total {fmt(amount)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-muted-foreground">Received on</label>
          <Input
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            disabled={!canSettle}
            className="h-7 w-[150px] text-xs"
          />
        </div>
      </div>

      {!editable && (
        <p className="text-xs text-muted-foreground italic">
          Read-only — only an admin can change allocations.
          {canSettle && " You can still confirm this payout as-is."}
        </p>
      )}

      <div className="space-y-2">
        {splits.map((s, idx) => (
          <div
            key={idx}
            className="grid grid-cols-12 gap-2 items-center bg-background rounded-md border border-border/60 px-2 py-1.5"
          >
            {editable ? (
              <>
                <Select
                  value={s.role}
                  onValueChange={(v) => updateSplit(idx, { role: v as SplitRole })}
                >
                  <SelectTrigger className="col-span-2 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={s.recipient_user_id ?? "__house"}
                  onValueChange={(v) =>
                    updateSplit(idx, { recipient_user_id: v === "__house" ? null : v })
                  }
                >
                  <SelectTrigger className="col-span-4 h-8 text-xs">
                    <SelectValue placeholder="Recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__house">— House (agency) —</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.user_id} value={a.user_id}>
                        {a.full_name || a.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="col-span-2 flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={s.percent}
                    onChange={(e) => changePercent(idx, Number(e.target.value))}
                    className="h-8 text-xs tabular-nums"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>

                <div className="col-span-2 flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={s.amount}
                    onChange={(e) => changeAmount(idx, Number(e.target.value))}
                    className="h-8 text-xs tabular-nums"
                  />
                </div>

                <div className="col-span-2 flex items-center justify-end gap-1">
                  <Input
                    placeholder="Note"
                    value={s.notes ?? ""}
                    onChange={(e) => updateSplit(idx, { notes: e.target.value })}
                    className="h-8 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeSplit(idx)}
                    aria-label="Remove split"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="col-span-2 text-xs capitalize">{s.role}</span>
                <span className="col-span-4 text-xs truncate">
                  {s.recipient_user_id
                    ? agents.find((a) => a.user_id === s.recipient_user_id)?.full_name || s.recipient_user_id.slice(0, 8)
                    : "House (agency)"}
                </span>
                <span className="col-span-2 text-xs tabular-nums">{s.percent}%</span>
                <span className="col-span-2 text-xs tabular-nums">{fmt(s.amount)}</span>
                <span className="col-span-2 text-xs text-muted-foreground truncate">{s.notes ?? ""}</span>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
        {editable ? (
          <Button variant="outline" size="sm" onClick={addSplit} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Add split
          </Button>
        ) : <span />}

        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Total {fmt(totalAmount)} ({totalPercent.toFixed(2)}%)
          </span>
          {balanced ? (
            <span className="inline-flex items-center gap-1 text-success font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Balanced
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-warning font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              Off by {fmt(amount - totalAmount)}
            </span>
          )}
        </div>

        {canSettle && (
          <div className="flex items-center gap-2 ml-auto">
            {existing && (
              <Button variant="ghost" size="sm" onClick={handleDiscard} className="h-7 text-xs">
                Discard
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleStage}
              disabled={!balanced}
              className="h-7 text-xs"
            >
              Stage for payout
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}