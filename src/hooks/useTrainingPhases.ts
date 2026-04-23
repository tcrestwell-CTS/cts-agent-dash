import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTrainingPhases() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_phases")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useTrainingPhase(phaseId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-phase", phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_phases")
        .select("*")
        .eq("id", phaseId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!phaseId,
  });
}

export function useCreatePhase() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (phase: { title: string; description?: string; sort_order?: number; status?: string; estimated_minutes?: number }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("training_phases")
        .insert({ ...phase, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-phases"] }),
  });
}

export function useUpdatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; description?: string; sort_order?: number; status?: string; estimated_minutes?: number }) => {
      const { error } = await supabase.from("training_phases").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-phases"] }),
  });
}

export function useDeletePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_phases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-phases"] }),
  });
}