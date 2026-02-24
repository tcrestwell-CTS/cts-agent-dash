import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingProgress {
  id: string;
  user_id: string;
  profile_completed: boolean;
  first_client_added: boolean;
  first_trip_created: boolean;
  first_booking_added: boolean;
  branding_configured: boolean;
  training_started: boolean;
  onboarding_completed_at: string | null;
}

export function useOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: progress, isLoading } = useQuery({
    queryKey: ["onboarding-progress", user?.id],
    queryFn: async () => {
      // Try to get existing progress
      const { data, error } = await supabase
        .from("agent_onboarding_progress")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;

      // If no progress exists, create one
      if (!data) {
        const { data: newProgress, error: insertError } = await supabase
          .from("agent_onboarding_progress")
          .insert({ user_id: user!.id })
          .select()
          .single();

        if (insertError) throw insertError;
        return newProgress as OnboardingProgress;
      }

      return data as OnboardingProgress;
    },
    enabled: !!user,
  });

  const updateStep = useMutation({
    mutationFn: async (step: Partial<OnboardingProgress>) => {
      const { error } = await supabase
        .from("agent_onboarding_progress")
        .update(step)
        .eq("user_id", user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
    },
  });

  const completedSteps = progress
    ? [
        progress.profile_completed,
        progress.first_client_added,
        progress.first_trip_created,
        progress.first_booking_added,
        progress.branding_configured,
        progress.training_started,
      ].filter(Boolean).length
    : 0;

  const totalSteps = 6;
  const isComplete = progress?.onboarding_completed_at !== null;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return {
    progress,
    isLoading,
    updateStep,
    completedSteps,
    totalSteps,
    isComplete,
    progressPercent,
  };
}
