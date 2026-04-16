import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskRun {
  id: string;
  task_name: string;
  task_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  result_summary: string | null;
  error_message: string | null;
  metadata: Record<string, any> | null;
  user_id: string | null;
  created_at: string;
}

export function useTaskRuns(filters?: { task_type?: string; status?: string; limit?: number }) {
  return useQuery({
    queryKey: ["task-runs", filters],
    queryFn: async () => {
      let query = supabase
        .from("task_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(filters?.limit ?? 100);

      if (filters?.task_type && filters.task_type !== "all") {
        query = query.eq("task_type", filters.task_type);
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TaskRun[];
    },
    refetchInterval: 30000,
  });
}

export function useTaskRunStats() {
  return useQuery({
    queryKey: ["task-run-stats"],
    queryFn: async () => {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("task_runs")
        .select("task_type, status")
        .gte("started_at", last24h);

      if (error) throw error;

      const runs = data ?? [];
      return {
        total: runs.length,
        success: runs.filter((r) => r.status === "success").length,
        failed: runs.filter((r) => r.status === "failed").length,
        running: runs.filter((r) => r.status === "running").length,
        byType: {
          cron: runs.filter((r) => r.task_type === "cron").length,
          edge_function: runs.filter((r) => r.task_type === "edge_function").length,
          ai_agent: runs.filter((r) => r.task_type === "ai_agent").length,
        },
      };
    },
    refetchInterval: 30000,
  });
}
