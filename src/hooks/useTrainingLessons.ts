import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTrainingLessons(moduleId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-lessons", moduleId],
    queryFn: async () => {
      let query = supabase.from("training_lessons").select("*").order("sort_order", { ascending: true });
      if (moduleId) query = query.eq("module_id", moduleId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useTrainingLesson(lessonId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-lesson", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_lessons")
        .select("*, training_modules_v2(id, title, phase_id, training_phases(title))")
        .eq("id", lessonId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!lessonId,
  });
}

export function useCreateLesson() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (lesson: { module_id: string; title: string; description?: string; lesson_type?: string; content_body?: string; video_url?: string; external_url?: string; sort_order?: number; is_required?: boolean; estimated_minutes?: number; status?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("training_lessons")
        .insert({ ...lesson, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-lessons"] }),
  });
}

export function useUpdateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const { error } = await supabase.from("training_lessons").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-lessons"] });
      qc.invalidateQueries({ queryKey: ["training-lesson"] });
    },
  });
}

export function useDeleteLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-lessons"] }),
  });
}