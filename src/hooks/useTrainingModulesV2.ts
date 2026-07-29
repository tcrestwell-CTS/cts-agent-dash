import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTrainingModulesV2(phaseId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-modules-v2", phaseId],
    queryFn: async () => {
      let query = supabase.from("training_modules_v2").select("*").order("sort_order", { ascending: true });
      if (phaseId) query = query.eq("phase_id", phaseId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useTrainingModuleV2(moduleId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-module-v2", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_modules_v2")
        .select("*, training_phases(title)")
        .eq("id", moduleId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!moduleId,
  });
}

export function useCreateModuleV2() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (mod: { phase_id: string; title: string; description?: string; sort_order?: number; is_required?: boolean; estimated_minutes?: number; status?: string; unlock_rule?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("training_modules_v2")
        .insert({ ...mod, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-modules-v2"] }),
  });
}

export function useUpdateModuleV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const { error } = await supabase.from("training_modules_v2").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-modules-v2"] });
      qc.invalidateQueries({ queryKey: ["training-module-v2"] });
    },
  });
}

export function useDeleteModuleV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_modules_v2").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-modules-v2"] }),
  });
}