import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SplitRole = "agent" | "mentor" | "house" | "custom";

export interface CommissionSplit {
  id: string;
  commission_id: string;
  recipient_user_id: string | null;
  role: SplitRole;
  percent: number | null;
  amount: number;
  status: "draft" | "confirmed" | "paid";
  notes: string | null;
  paid_date: string | null;
  created_at: string;
}

export interface SplitDraft {
  recipient_user_id: string | null;
  role: SplitRole;
  percent: number;
  amount: number;
  notes?: string;
}

export interface CommissionPayoutEdit {
  commission_id: string;
  booking_id: string;
  paid_date: string;
  total: number;
  splits: SplitDraft[];
}

// ── Draft context ───────────────────────────────────────────────────────────
interface DraftCtx {
  drafts: Record<string, CommissionPayoutEdit>;
  stage: (edit: CommissionPayoutEdit) => void;
  unstage: (commissionId: string) => void;
  clearAll: () => void;
  count: number;
}
const Ctx = createContext<DraftCtx | null>(null);

export function CommissionPayoutDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, CommissionPayoutEdit>>({});

  const stage = useCallback((edit: CommissionPayoutEdit) => {
    setDrafts((d) => ({ ...d, [edit.commission_id]: edit }));
  }, []);
  const unstage = useCallback((id: string) => {
    setDrafts((d) => {
      const { [id]: _drop, ...rest } = d;
      return rest;
    });
  }, []);
  const clearAll = useCallback(() => setDrafts({}), []);

  const value = useMemo<DraftCtx>(
    () => ({ drafts, stage, unstage, clearAll, count: Object.keys(drafts).length }),
    [drafts, stage, unstage, clearAll]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePayoutDraft() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePayoutDraft must be used inside CommissionPayoutDraftProvider");
  return ctx;
}

// ── Existing splits fetch ───────────────────────────────────────────────────
export function useCommissionSplits(commissionIds: string[]) {
  return useQuery({
    queryKey: ["commission-splits", commissionIds.slice().sort().join(",")],
    enabled: commissionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("commission_splits")
        .select("*")
        .in("commission_id", commissionIds);
      if (error) throw error;
      return data as CommissionSplit[];
    },
  });
}

// ── Mentor assignments (mentee -> mentor info) ──────────────────────────────
export interface MentorRule {
  mentee_user_id: string;
  mentor_user_id: string;
  split_percent: number;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
}

export function useMentorRules() {
  return useQuery({
    queryKey: ["mentor-rules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mentor_assignments")
        .select("mentee_user_id, mentor_user_id, split_percent, is_active, effective_from, effective_to")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as MentorRule[];
    },
  });
}

// ── Confirm payout mutation ─────────────────────────────────────────────────
export function useConfirmPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (edits: CommissionPayoutEdit[]) => {
      const payload = edits.map((e) => ({
        commission_id: e.commission_id,
        paid_date: e.paid_date,
        splits: e.splits.map((s) => ({
          recipient_user_id: s.recipient_user_id,
          role: s.role,
          percent: s.percent,
          amount: s.amount,
          notes: s.notes ?? null,
        })),
      }));
      const { data, error } = await (supabase as any).rpc("confirm_commission_payout", {
        p_edits: payload,
      });
      if (error) throw error;
      return data as { confirmed: number };
    },
    onSuccess: (data) => {
      toast.success(`Confirmed ${data?.confirmed ?? 0} payout line${data?.confirmed === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["commission-report"] });
      qc.invalidateQueries({ queryKey: ["commissions"] });
      qc.invalidateQueries({ queryKey: ["commission-splits"] });
      qc.invalidateQueries({ queryKey: ["bookkeeper-payouts"] });
    },
    onError: (e: any) => toast.error("Confirm payout failed: " + (e?.message ?? e)),
  });
}