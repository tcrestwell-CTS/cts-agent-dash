import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { useTrainingQuiz, useMyQuizAttempts, useSubmitQuizAttempt } from "@/hooks/useTrainingQuizzes";
import { toast } from "sonner";

interface TrainingQuizProps {
  quizId: string;
  onPass?: () => void;
}

export function TrainingQuiz({ quizId, onPass }: TrainingQuizProps) {
  const { data: quiz, isLoading } = useTrainingQuiz(quizId);
  const { data: attempts } = useMyQuizAttempts(quizId);
  const submitAttempt = useSubmitQuizAttempt();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; details: Record<string, boolean> } | null>(null);

  if (isLoading || !quiz) return null;

  const questions = ((quiz as Record<string, unknown>).training_quiz_questions as Array<{
    id: string;
    question_text: string;
    answer_options: string[];
    correct_answer: string;
    explanation: string | null;
    sort_order: number;
  }>) || [];
  const sortedQuestions = [...questions].sort((a, b) => a.sort_order - b.sort_order);

  const passingScore = quiz.passing_score || 70;
  const retryLimit = quiz.retry_limit || 3;
  const attemptCount = attempts?.length || 0;
  const hasPassed = attempts?.some(a => a.passed);
  const canRetry = !hasPassed && attemptCount < retryLimit;

  const handleSubmit = async () => {
    let correct = 0;
    const details: Record<string, boolean> = {};
    sortedQuestions.forEach(q => {
      const isCorrect = answers[q.id] === q.correct_answer;
      details[q.id] = isCorrect;
      if (isCorrect) correct++;
    });
    const score = sortedQuestions.length > 0 ? Math.round((correct / sortedQuestions.length) * 100) : 0;
    const passed = score >= passingScore;

    setResult({ score, passed, details });
    setSubmitted(true);

    await submitAttempt.mutateAsync({
      quiz_id: quizId,
      score,
      passed,
      answers: Object.entries(answers).map(([qId, ans]) => ({ question_id: qId, answer: ans })),
    });

    if (passed) {
      toast.success(`Quiz passed with ${score}%! 🎉`);
      onPass?.();
    } else {
      toast.error(`Score: ${score}%. Need ${passingScore}% to pass.`);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
  };

  if (hasPassed && !submitted) {
    const bestScore = Math.max(...(attempts || []).map(a => a.score));
    return (
      <div className="bg-success/10 border border-success/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <h3 className="font-semibold text-foreground">Quiz Passed!</h3>
        </div>
        <p className="text-sm text-muted-foreground">Best score: {bestScore}% • {attemptCount} attempt{attemptCount !== 1 ? "s" : ""}</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card border border-border/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{quiz.title || "Quiz"}</h3>
        <Badge variant="outline" className="text-xs">
          Pass: {passingScore}% • {retryLimit - attemptCount} attempt{retryLimit - attemptCount !== 1 ? "s" : ""} left
        </Badge>
      </div>
      {quiz.description && <p className="text-sm text-muted-foreground mb-6">{quiz.description}</p>}

      <div className="space-y-6">
        {sortedQuestions.map((q, idx) => {
          const options: string[] = Array.isArray(q.answer_options) ? q.answer_options : [];
          const isCorrect = result?.details[q.id];
          return (
            <div key={q.id} className="space-y-3">
              <p className="font-medium text-sm text-foreground">{idx + 1}. {q.question_text}</p>
              <div className="space-y-2 ml-4">
                {options.map((opt, oi) => {
                  const selected = answers[q.id] === opt;
                  const showCorrect = submitted && opt === q.correct_answer;
                  const showWrong = submitted && selected && !isCorrect;
                  return (
                    <label
                      key={oi}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        submitted
                          ? showCorrect ? "border-success bg-success/5" : showWrong ? "border-destructive bg-destructive/5" : "border-border/50"
                          : selected ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={selected}
                        onChange={() => !submitted && setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                        disabled={submitted}
                        className="accent-primary"
                      />
                      <span className="text-sm text-card-foreground">{opt}</span>
                      {submitted && showCorrect && <CheckCircle2 className="h-4 w-4 text-success ml-auto" />}
                      {submitted && showWrong && <XCircle className="h-4 w-4 text-destructive ml-auto" />}
                    </label>
                  );
                })}
              </div>
              {submitted && q.explanation && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded ml-4">{q.explanation}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
        {submitted && result ? (
          <div className="flex items-center gap-3">
            <Badge className={result.passed ? "bg-success/10 text-success border-0" : "bg-destructive/10 text-destructive border-0"}>
              Score: {result.score}%
            </Badge>
            {!result.passed && canRetry && (
              <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Retry
              </Button>
            )}
          </div>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < sortedQuestions.length || submitAttempt.isPending}
          >
            Submit Quiz
          </Button>
        )}
      </div>
    </div>
  );
}
