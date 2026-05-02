// src/hooks/useRecon.ts
// Data hooks for the reconciliation agent UI

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────

export type ReconMatchStatus =
  | "new" | "reviewing" | "approved" | "posted_to_qbo"
  | "rejected" | "exception";

export type ExceptionStatus = "open" | "in_review" | "resolved" | "archived";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "failed" | "skipped";

export interface ReconMatch {
  id: string;
  match_type: string;
  crm_booking_id: string | null;
  stripe_payment_id: string | null;
  stripe_payout_id: string | null;
  qbo_invoice_id: string | null;
  qbo_payment_id: string | null;
  qbo_deposit_id: string | null;
  qbo_bill_id: string | null;
  confidence_score: number;
  score_breakdown: Record<string, number> | null;
  match_explanation: string | null;
  crm_amount: number | null;
  qbo_amount: number | null;
  stripe_amount: number | null;
  amount_variance: number | null;
  crm_date: string | null;
  qbo_date: string | null;
  stripe_date: string | null;
  date_variance_days: number | null;
  status: ReconMatchStatus;
  recommended_action: string | null;
  auto_matched: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExceptionQueueItem {
  id: string;
  exception_type: string;
  source_system: string | null;
  source_record_id: string | null;
  source_record_type: string | null;
  recon_match_id: string | null;
  description: string | null;
  amount: number | null;
  assigned_to: string | null;
  status: ExceptionStatus;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalTask {
  id: string;
  recon_match_id: string | null;
  exception_id: string | null;
  action_type: string;
  action_payload: Record<string, unknown> | null;
  requires_admin: boolean;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  qbo_response: Record<string, unknown> | null;
  qbo_object_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconStats {
  total_matches: number;
  auto_matched: number;
  needs_review: number;
  posted_to_qbo: number;
  exceptions_open: number;
  approvals_pending: number;
  unreconciled_stripe_payouts: number;
  missing_qbo_invoices: number;
  missing_qbo_payments: number;
  missing_qbo_bills: number;
}

// ─── Stats ────────────────────────────────────────────────────

export function useReconStats() {
  return useQuery({
    queryKey: ["recon-stats"],
    queryFn: async (): Promise<ReconStats> => {
      const [matches, exceptions, approvals, payouts] = await Promise.all([
        supabase.from("recon_matches").select("status, auto_matched"),
        supabase.from("exception_queue").select("status, exception_type"),
        supabase.from("approval_tasks").select("status"),
        supabase.from("stripe_payouts").select("reconciled"),
      ]);

      const m = matches.data || [];
      const e = exceptions.data || [];
      const a = approvals.data || [];
      const p = payouts.data || [];

      return {
        total_matches: m.length,
        auto_matched: m.filter((x) => x.auto_matched).length,
        needs_review: m.filter((x) => x.status === "new").length,
        posted_to_qbo: m.filter((x) => x.status === "posted_to_qbo").length,
        exceptions_open: e.filter((x) => x.status === "open").length,
        approvals_pending: a.filter((x) => x.status === "pending").length,
        unreconciled_stripe_payouts: p.filter((x) => !x.reconciled).length,
        missing_qbo_invoices: e.filter(
          (x) => x.exception_type === "missing_qbo_invoice"
        ).length,
        missing_qbo_payments: e.filter(
          (x) => x.exception_type === "unmatched_stripe_payment"
        ).length,
        missing_qbo_bills: e.filter(
          (x) => x.exception_type === "missing_qbo_bill"
        ).length,
      };
    },
    refetchInterval: 60_000,
  });
}

// ─── Matches ─────────────────────────────────────────────────

export function useReconMatches(status?: ReconMatchStatus, matchType?: string) {
  return useQuery({
    queryKey: ["recon-matches", status, matchType],
    queryFn: async () => {
      let q = supabase
        .from("recon_matches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status) q = q.eq("status", status);
      if (matchType) q = q.eq("match_type", matchType);
      const { data, error } = await q;
      if (error) throw error;
      return data as ReconMatch[];
    },
  });
}

// ─── Exceptions ───────────────────────────────────────────────

export function useExceptions(status?: ExceptionStatus, type?: string) {
  return useQuery({
    queryKey: ["exceptions", status, type],
    queryFn: async () => {
      let q = supabase
        .from("exception_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status) q = q.eq("status", status);
      if (type) q = q.eq("exception_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data as ExceptionQueueItem[];
    },
  });
}

// ─── Approvals ────────────────────────────────────────────────

export function useApprovalTasks(status?: ApprovalStatus) {
  return useQuery({
    queryKey: ["approval-tasks", status],
    queryFn: async () => {
      let q = supabase
        .from("approval_tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data as ApprovalTask[];
    },
  });
}

// ─── Stripe Payouts ───────────────────────────────────────────

export function useStripePayouts() {
  return useQuery({
    queryKey: ["stripe-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_payouts")
        .select(`
          *,
          stripe_payout_payments (
            gross_amount,
            fee_amount,
            net_contribution,
            stripe_payment_id,
            stripe_payments (
              invoice_number,
              customer_name,
              customer_email,
              gross_amount,
              stripe_fee
            )
          )
        `)
        .order("arrival_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

// ─── Audit Log ────────────────────────────────────────────────

export function useReconAuditLog(limit = 100) {
  return useQuery({
    queryKey: ["recon-audit-log", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recon_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

// ─── Account Config ───────────────────────────────────────────

export function useReconConfig() {
  return useQuery({
    queryKey: ["recon-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recon_account_config")
        .select("*")
        .eq("company_id", "crestwell")
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ─── Mutations ────────────────────────────────────────────────

export function useRunRecon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runOnly?: string[]) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recon-engine`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-agent-secret": import.meta.env.VITE_AGENT_SECRET,
          },
          body: JSON.stringify({ run: runOnly }),
        }
      );
      if (!resp.ok) throw new Error("Reconciliation run failed");
      return resp.json();
    },
    onSuccess: () => {
      toast.success("Reconciliation run complete");
      qc.invalidateQueries({ queryKey: ["recon-matches"] });
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["approval-tasks"] });
      qc.invalidateQueries({ queryKey: ["recon-stats"] });
    },
    onError: (e) => toast.error(`Reconciliation failed: ${e.message}`),
  });
}

export function useRunQBOSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (objects?: string[]) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-cache-sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-agent-secret": import.meta.env.VITE_AGENT_SECRET,
          },
          body: JSON.stringify({ objects }),
        }
      );
      if (!resp.ok) throw new Error("QBO sync failed");
      return resp.json();
    },
    onSuccess: () => {
      toast.success("QBO cache sync complete");
      qc.invalidateQueries({ queryKey: ["recon-stats"] });
    },
    onError: (e) => toast.error(`QBO sync failed: ${e.message}`),
  });
}

export function useApproveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      approvedBy,
      approvedByEmail,
    }: {
      taskId: string;
      approvedBy: string;
      approvedByEmail: string;
    }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recon-approvals`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-agent-secret": import.meta.env.VITE_AGENT_SECRET,
          },
          body: JSON.stringify({
            task_id: taskId,
            approved_by: approvedBy,
            approved_by_email: approvedByEmail,
          }),
        }
      );
      if (!resp.ok) throw new Error("Approval failed");
      return resp.json();
    },
    onSuccess: () => {
      toast.success("QBO write executed successfully");
      qc.invalidateQueries({ queryKey: ["approval-tasks"] });
      qc.invalidateQueries({ queryKey: ["recon-matches"] });
      qc.invalidateQueries({ queryKey: ["recon-stats"] });
    },
    onError: (e) => toast.error(`Approval failed: ${e.message}`),
  });
}

export function useRejectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      reason,
    }: {
      taskId: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("approval_tasks")
        .update({
          status: "rejected",
          rejection_reason: reason,
          rejected_at: new Date().toISOString(),
        })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task rejected");
      qc.invalidateQueries({ queryKey: ["approval-tasks"] });
      qc.invalidateQueries({ queryKey: ["recon-stats"] });
    },
    onError: (e) => toast.error(`Rejection failed: ${e.message}`),
  });
}

export function useResolveException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string;
      notes: string;
    }) => {
      const { error } = await supabase
        .from("exception_queue")
        .update({
          status: "resolved",
          resolution_notes: notes,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exception resolved");
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["recon-stats"] });
    },
  });
}
