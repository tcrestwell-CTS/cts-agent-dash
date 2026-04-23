import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTrainingQuiz(quizId: string | undefined | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-quiz", quizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_quizzes")
        .select("*, training_quiz_questions(*)")
        .eq("id", quizId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!quizId,
  });
}

export function useMyQuizAttempts(quizId: string | undefined | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["training-quiz-attempts", quizId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_quiz_attempts")
        .select("*")
        .eq("user_id", user!.id)
        .eq("quiz_id", quizId!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!quizId,
  });
}

export function useSubmitQuizAttempt() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (attempt: { quiz_id: string; score: number; passed: boolean; answers: unknown[] }) => {
      if (!user) throw new Error("Not authenticated");
      const row = { quiz_id: attempt.quiz_id, score: attempt.score, passed: attempt.passed, answers: attempt.answers as unknown, user_id: user.id };
      const { data, error } = await supabase
        .from("training_quiz_attempts")
        .insert([row])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["training-quiz-attempts", vars.quiz_id] });
    },
  });
}