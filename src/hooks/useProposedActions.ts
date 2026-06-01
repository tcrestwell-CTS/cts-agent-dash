import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProposedAction {
  id: string;
  user_id: string;
  agent_name: string;
  action_type: string;
  target_table: string | null;
  target_id: string | null;
  summary: string;
  reasoning: string | null;
  proposed_changes: Record<string, unknown>;
  source: string | null;
  status: "pending" | "approved" | "rejected" | "applied" | "failed" | "auto_applied";
  confidence: number | null;
  auto_apply_eligible: boolean;
  approved_by: string | null;
  approved_at: string | null;
  applied_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useProposedActions(filter?: { status?: string; agent?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["proposed-actions", filter?.status ?? "all", filter?.agent ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("ai_proposed_actions" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter?.status) q = q.eq("status", filter.status);
      if (filter?.agent) q = q.eq("agent_name", filter.agent);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown) as ProposedAction[];
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("proposed-actions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_proposed_actions" },
        () => qc.invalidateQueries({ queryKey: ["proposed-actions"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approve" | "reject" }) => {
      const { data, error } = await supabase.functions.invoke("apply-proposed-action", {
        body: { action_id: id, decision },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposed-actions"] }),
  });

  const pending = (query.data ?? []).filter((a) => a.status === "pending");

  return {
    actions: query.data ?? [],
    pending,
    pendingCount: pending.length,
    isLoading: query.isLoading,
    decide,
  };
}