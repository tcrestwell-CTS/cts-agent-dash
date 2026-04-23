import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTrainingBadges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_badges").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useMyBadges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-user-badges", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_user_badges")
        .select("*, training_badges(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}