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
          .update(base as Record<string, unknown>)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("training_user_progress")
          .insert([base as { user_id: string; status: string; [key: string]: unknown }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-progress-v2"] });
    },
  });
}

/**
 * After a lesson is marked complete, check if all required lessons in the module
 * are done. If so, auto-complete the module. Then check if all required modules
 * in the phase are done. If so, auto-complete the phase. Then auto-award badges.
 */
export function useAutoRollupProgress() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { lesson_id: string; module_id: string; phase_id: string }) => {
      if (!user) throw new Error("Not authenticated");
      const now = new Date().toISOString();

      // 1. Check module completion: are all required lessons in this module completed?
      const { data: moduleLessons } = await supabase
        .from("training_lessons")
        .select("id, is_required")
        .eq("module_id", params.module_id);

      const requiredLessons = (moduleLessons || []).filter(l => l.is_required);
      if (requiredLessons.length > 0) {
        const { data: lessonProgress } = await supabase
          .from("training_user_progress")
          .select("lesson_id, status")
          .eq("user_id", user.id)
          .in("lesson_id", requiredLessons.map(l => l.id));

        const completedIds = new Set((lessonProgress || []).filter(p => p.status === "completed").map(p => p.lesson_id));
        const allRequiredDone = requiredLessons.every(l => completedIds.has(l.id));

        if (allRequiredDone) {
          // Auto-complete module
          const { data: existingMod } = await supabase
            .from("training_user_progress")
            .select("id")
            .eq("user_id", user.id)
            .eq("module_id", params.module_id)
            .is("lesson_id", null)
            .maybeSingle();

          const modBase = {
            user_id: user.id,
            module_id: params.module_id,
            phase_id: params.phase_id,
            status: "completed" as const,
            percent_complete: 100,
            completed_at: now,
            last_viewed_at: now,
          };

          if (existingMod) {
            await supabase.from("training_user_progress").update(modBase).eq("id", existingMod.id);
          } else {
            await supabase.from("training_user_progress").insert([modBase]);
          }

          // Auto-award module badge
          const { data: moduleBadge } = await supabase
            .from("training_badges")
            .select("id")
            .eq("criteria_type", "module")
            .eq("criteria_id", params.module_id)
            .maybeSingle();

          if (moduleBadge) {
            const { data: alreadyEarned } = await supabase
              .from("training_user_badges")
              .select("id")
              .eq("user_id", user.id)
              .eq("badge_id", moduleBadge.id)
              .maybeSingle();

            if (!alreadyEarned) {
              await supabase.from("training_user_badges").insert([{
                user_id: user.id,
                badge_id: moduleBadge.id,
              }]);
            }
          }

          // 2. Check phase completion
          const { data: phaseModules } = await supabase
            .from("training_modules_v2")
            .select("id, is_required")
            .eq("phase_id", params.phase_id);

          const requiredModules = (phaseModules || []).filter(m => m.is_required);
          if (requiredModules.length > 0) {
            const { data: modProgress } = await supabase
              .from("training_user_progress")
              .select("module_id, status")
              .eq("user_id", user.id)
              .is("lesson_id", null)
              .in("module_id", requiredModules.map(m => m.id));

            const completedModIds = new Set((modProgress || []).filter(p => p.status === "completed").map(p => p.module_id));
            const allModsDone = requiredModules.every(m => completedModIds.has(m.id));

            if (allModsDone) {
              const { data: existingPhase } = await supabase
                .from("training_user_progress")
                .select("id")
                .eq("user_id", user.id)
                .eq("phase_id", params.phase_id)
                .is("module_id", null)
                .is("lesson_id", null)
                .maybeSingle();

              const phaseBase = {
                user_id: user.id,
                phase_id: params.phase_id,
                status: "completed" as const,
                percent_complete: 100,
                completed_at: now,
                last_viewed_at: now,
              };

              if (existingPhase) {
                await supabase.from("training_user_progress").update(phaseBase).eq("id", existingPhase.id);
              } else {
                await supabase.from("training_user_progress").insert([phaseBase]);
              }

              // Auto-award phase badge
              const { data: phaseBadge } = await supabase
                .from("training_badges")
                .select("id")
                .eq("criteria_type", "phase")
                .eq("criteria_id", params.phase_id)
                .maybeSingle();

              if (phaseBadge) {
                const { data: alreadyEarned } = await supabase
                  .from("training_user_badges")
                  .select("id")
                  .eq("user_id", user.id)
                  .eq("badge_id", phaseBadge.id)
                  .maybeSingle();

                if (!alreadyEarned) {
                  await supabase.from("training_user_badges").insert([{
                    user_id: user.id,
                    badge_id: phaseBadge.id,
                  }]);
                }
              }
            }
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-progress-v2"] });
      qc.invalidateQueries({ queryKey: ["training-user-badges"] });
    },
  });
}
