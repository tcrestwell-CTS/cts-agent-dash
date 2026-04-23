import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useMyTrainingProgressV2() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-progress-v2", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_user_progress")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAllTrainingProgress() {
  return useQuery({
    queryKey: ["training-progress-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_user_progress")
        .select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertProgress() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      lesson_id?: string;
      module_id?: string;
      phase_id?: string;
      status: "not_started" | "in_progress" | "completed";
      notes?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();
      const base: Record<string, unknown> = {
        user_id: user.id,
        status: params.status,
        last_viewed_at: now,
      };
      if (params.lesson_id) base.lesson_id = params.lesson_id;
      if (params.module_id) base.module_id = params.module_id;
      if (params.phase_id) base.phase_id = params.phase_id;
      if (params.notes !== undefined) base.notes = params.notes;
      if (params.status === "completed") {
        base.completed_at = now;
        base.percent_complete = 100;
      } else if (params.status === "in_progress") {
        base.percent_complete = 50;
      }

      // Find existing
      let query = supabase.from("training_user_progress").select("id").eq("user_id", user.id);
      if (params.lesson_id) query = query.eq("lesson_id", params.lesson_id);
      else if (params.module_id) query = query.eq("module_id", params.module_id).is("lesson_id", null);
      else if (params.phase_id) query = query.eq("phase_id", params.phase_id).is("module_id", null).is("lesson_id", null);

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("training_user_progress")
          .update(base)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("training_user_progress")
          .insert(base);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-progress-v2"] });
    },
  });
}