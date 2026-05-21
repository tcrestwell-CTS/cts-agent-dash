import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Logs a bookkeeper action to bookkeeper_audit_log. Silently no-ops on failure
 * so it never blocks the UI.
 */
export function useLogBookkeeperAction() {
  const { user } = useAuth();
  return useCallback(
    async (action: string, resource?: string, metadata?: Record<string, unknown>) => {
      if (!user?.id) return;
      try {
        await (supabase as any).from("bookkeeper_audit_log").insert({
          actor_id: user.id,
          action,
          resource: resource ?? null,
          metadata: metadata ?? null,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("audit log failed", e);
      }
    },
    [user?.id],
  );
}

export interface BookkeeperAuditRow {
  id: string;
  actor_id: string;
  action: string;
  resource: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useBookkeeperAuditLog(limit = 200) {
  return useQuery({
    queryKey: ["bookkeeper-audit-log", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookkeeper_audit_log")
        .select("id, actor_id, action, resource, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as BookkeeperAuditRow[];
    },
  });
}

/**
 * Surfaces bookkeeper-relevant alerts:
 *  - Failed QBO syncs in the last 7 days
 *  - Unattributed deposits older than 7 days
 */
export function useBookkeeperAlerts() {
  return useQuery({
    queryKey: ["bookkeeper-alerts"],
    staleTime: 60_000,
    queryFn: async () => {
      const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [failedRes, staleRes] = await Promise.all([
        (supabase as any)
          .from("qbo_sync_logs")
          .select("id", { count: "exact", head: true })
          .eq("status", "error")
          .gte("created_at", sevenAgo),
        (supabase as any)
          .from("checkout_payments")
          .select("id", { count: "exact", head: true })
          .eq("payment_type", "unattributed_deposit")
          .lt("created_at", sevenAgo),
      ]);
      return {
        failedSyncs: failedRes.count ?? 0,
        staleUnattributed: staleRes.count ?? 0,
      };
    },
  });
}