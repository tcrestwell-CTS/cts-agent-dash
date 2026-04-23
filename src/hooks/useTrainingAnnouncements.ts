import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useActiveAnnouncements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-announcements-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_announcements")
        .select("*")
        .eq("status", "published")
        .lte("start_date", new Date().toISOString().split("T")[0])
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Filter out expired announcements client-side (end_date check)
      const today = new Date().toISOString().split("T")[0];
      return (data || []).filter(a => !a.end_date || a.end_date >= today);
    },
    enabled: !!user,
  });
}

export function useAllAnnouncements() {
  return useQuery({
    queryKey: ["training-announcements-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (ann: { title: string; body?: string; status?: string; is_pinned?: boolean; start_date?: string; end_date?: string; audience?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("training_announcements")
        .insert({ ...ann, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-announcements-active"] });
      qc.invalidateQueries({ queryKey: ["training-announcements-all"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-announcements-active"] });
      qc.invalidateQueries({ queryKey: ["training-announcements-all"] });
    },
  });
}