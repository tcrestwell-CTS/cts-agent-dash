import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Agency "other income" — revenue the agency earns outside of trip commissions:
 *  1. Advisor subscription payments (monthly platform/host fees paid by advisors)
 *  2. Loan repayments (interest is income; principal repays the loan receivable)
 *
 * Loan rows are derived from `loan_payment_schedules` (already the source of
 * truth + QBO sync). Subscriptions live in `agent_subscription_payments`.
 */

export interface AgentSubscriptionPayment {
  id: string;
  agent_user_id: string;
  plan_name: string | null;
  amount: number;
  payment_date: string;
  period_start: string | null;
  period_end: string | null;
  payment_method: string;
  status: string;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  stripe_fee: number;
  notes: string | null;
  qbo_deposit_id: string | null;
  qbo_synced_at: string | null;
  created_at: string;
}

export type OtherIncomeSource = "agent_subscription" | "loan_interest";

export interface OtherIncomeRow {
  id: string;
  source: OtherIncomeSource;
  label: string;
  date: string;
  /** Income recognized (subscription amount, or loan interest) */
  amount: number;
  /** Non-income portion (loan principal repayment) — excluded from income totals */
  principal: number;
  reference: string | null;
}

export interface AgencyOtherIncomeRange {
  /** inclusive ISO date (yyyy-MM-dd) */
  start: string;
  /** exclusive ISO date (yyyy-MM-dd) */
  end: string;
}

export function useAgentSubscriptionPayments(range?: AgencyOtherIncomeRange) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["agent-subscription-payments", range?.start ?? null, range?.end ?? null],
    queryFn: async () => {
      let q = (supabase as any)
        .from("agent_subscription_payments")
        .select("*")
        .order("payment_date", { ascending: false })
        .limit(1000);

      if (range) q = q.gte("payment_date", range.start).lt("payment_date", range.end);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AgentSubscriptionPayment[];
    },
    enabled: !!user,
  });
}

export function useAgencyOtherIncome(range?: AgencyOtherIncomeRange) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["agency-other-income", range?.start ?? null, range?.end ?? null],
    queryFn: async () => {
      let subsQuery = (supabase as any)
        .from("agent_subscription_payments")
        .select("id, agent_user_id, plan_name, amount, payment_date, stripe_payment_intent_id, status")
        .eq("status", "paid")
        .limit(1000);
      let loanQuery = (supabase as any)
        .from("loan_payment_schedules")
        .select(
          "id, paid_date, principal_amount, interest_amount, total_payment, payment_number, status, loan_application_id, stripe_payment_intent_id",
        )
        .eq("status", "paid")
        .limit(1000);

      if (range) {
        subsQuery = subsQuery.gte("payment_date", range.start).lt("payment_date", range.end);
        loanQuery = loanQuery.gte("paid_date", range.start).lt("paid_date", range.end);
      }

      const [subsRes, loanRes, profilesRes] = await Promise.all([
        subsQuery,
        loanQuery,
        (supabase as any).from("profiles").select("user_id, full_name"),
      ]);

      if (subsRes.error) throw subsRes.error;
      if (loanRes.error) throw loanRes.error;

      const nameMap = new Map<string, string>(
        (profilesRes.data ?? []).map((p: any) => [p.user_id, p.full_name || "Advisor"]),
      );

      const rows: OtherIncomeRow[] = [
        ...(subsRes.data ?? []).map((s: any) => ({
          id: `sub-${s.id}`,
          source: "agent_subscription" as const,
          label: `${nameMap.get(s.agent_user_id) || "Advisor"} — ${s.plan_name || "Advisor subscription"}`,
          date: s.payment_date,
          amount: Number(s.amount || 0),
          principal: 0,
          reference: s.stripe_payment_intent_id ?? null,
        })),
        ...(loanRes.data ?? []).map((l: any) => ({
          id: `loan-${l.id}`,
          source: "loan_interest" as const,
          label: `Loan repayment — installment ${l.payment_number ?? "—"}`,
          date: l.paid_date,
          amount: Number(l.interest_amount || 0),
          principal: Number(l.principal_amount || 0),
          reference: l.stripe_payment_intent_id ?? null,
        })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1));

      const subscriptionTotal = rows
        .filter((r) => r.source === "agent_subscription")
        .reduce((s, r) => s + r.amount, 0);
      const loanInterestTotal = rows
        .filter((r) => r.source === "loan_interest")
        .reduce((s, r) => s + r.amount, 0);
      const loanPrincipalTotal = rows.reduce((s, r) => s + r.principal, 0);

      return {
        rows,
        subscriptionTotal,
        loanInterestTotal,
        loanPrincipalTotal,
        total: subscriptionTotal + loanInterestTotal,
      };
    },
    enabled: !!user,
  });
}

export function useSaveAgentSubscriptionPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: Partial<AgentSubscriptionPayment> & { agent_user_id: string; amount: number }) => {
      const { id, ...rest } = payload as any;
      if (id) {
        const { error } = await (supabase as any)
          .from("agent_subscription_payments")
          .update(rest)
          .eq("id", id);
        if (error) throw error;
        return id as string;
      }
      const { data, error } = await (supabase as any)
        .from("agent_subscription_payments")
        .insert({ ...rest, created_by: user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["agency-other-income"] });
      queryClient.invalidateQueries({ queryKey: ["bookkeeper-income"] });
      toast.success("Subscription payment saved");
    },
    onError: (e: any) => toast.error("Failed to save: " + e.message),
  });
}

export function useDeleteAgentSubscriptionPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("agent_subscription_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["agency-other-income"] });
      queryClient.invalidateQueries({ queryKey: ["bookkeeper-income"] });
      toast.success("Subscription payment removed");
    },
    onError: (e: any) => toast.error("Failed to remove: " + e.message),
  });
}
