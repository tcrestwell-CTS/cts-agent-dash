import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { AcademyLayout, AcademyCard, AcademyEyebrow } from "@/components/academy/AcademyLayout";
import { useAcademyData, useCompleteAcademyLesson, useTouchAcademyLesson } from "@/hooks/useAcademy";
import { TrainingQuiz } from "@/components/training/TrainingQuiz";
import { useMyQuizAttempts } from "@/hooks/useTrainingQuizzes";
import { toast } from "@/hooks/use-toast";

export default function AcademyLesson() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const academy = useAcademyData();
  const complete = useCompleteAcademyLesson();
  const touch = useTouchAcademyLesson();
  const [quizPassed, setQuizPassed] = useState(false);

  const found = useMemo(() => {
    for (const m of academy.modules) {
      const index = m.lessons.findIndex((l) => l.id === lessonId);
      if (index >= 0) return { module: m, lesson: m.lessons[index], index };
    }
    return null;
  }, [academy.modules, lessonId]);

  const { data: quizAttempts } = useMyQuizAttempts(found?.lesson.quiz_id);
  const quizAlreadyPassed = (quizAttempts || []).some((a) => a.passed);


  useEffect(() => {
    if (found && academy.phaseId) {
      touch.mutate({ lessonId: found.lesson.id, moduleId: found.module.id, phaseId: academy.phaseId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found?.lesson.id, academy.phaseId]);

  if (!found) {
    return (
      <AcademyLayout>
        <AcademyCard>
          <p className="text-[14px]" style={{ color: "var(--academy-ink-soft)" }}>
            {academy.isLoading ? "Loading lesson…" : "That lesson is no longer available."}
          </p>
        </AcademyCard>
      </AcademyLayout>
    );
  }

  const { module: mod, lesson, index } = found;
  const previous = index > 0 ? mod.lessons[index - 1] : null;
  const next = index < mod.lessons.length - 1 ? mod.lessons[index + 1] : null;
  const isDone = mod.completedLessonIds.has(lesson.id);

  const markComplete = async () => {
    if (!academy.phaseId) return;
    try {
      await complete.mutateAsync({ lessonId: lesson.id, moduleId: mod.id, phaseId: academy.phaseId });
      if (next) {
        navigate(`/academy/lesson/${next.id}`);
      } else {
        toast({ title: "Module complete", description: `${mod.title} is finished.` });
        navigate("/academy");
      }
    } catch {
      toast({ title: "Could not save progress", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <AcademyLayout>
      <div className="academy-grid" style={{ paddingBottom: 90 }}>
        <div>
          <AcademyEyebrow>
            Module {mod.sortOrder} · {mod.title}
          </AcademyEyebrow>
          <h1 className="mt-2 text-[29px]" style={{ fontFamily: "Lora, Georgia, serif" }}>
            {lesson.title}
          </h1>
          <p className="mt-2 text-[13px]" style={{ color: "var(--academy-ink-soft)" }}>
            Lesson {index + 1} of {mod.lessons.length} · ~{lesson.estimated_minutes || 10} min
          </p>

          {lesson.video_url && (
            <div className="mt-6" style={{ aspectRatio: "16 / 9", width: "100%" }}>
              <iframe
                src={lesson.video_url}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                style={{ width: "100%", height: "100%", border: "1px solid var(--academy-line)", borderRadius: 12 }}
              />
            </div>
          )}

          <div className="academy-prose mt-7">
            <ReactMarkdown>{lesson.content_body || lesson.description || "Content coming soon."}</ReactMarkdown>
          </div>

          {lesson.content_source_name && (
            <p className="mt-7 text-[11.5px]" style={{ color: "var(--academy-ink-soft)" }}>
              CTN source: {lesson.content_source_name}
              {lesson.content_source_updated_at
                ? ` · Updated ${new Date(lesson.content_source_updated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                : ""}
            </p>
          )}

          {lesson.external_url && (
            <a
              href={lesson.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block rounded-[10px] px-4 py-2.5 text-[13px] font-medium"
              style={{ border: "1px solid var(--academy-line)", color: "var(--academy-pine)" }}
            >
              Open the linked resource →
            </a>
          )}

          {lesson.quiz_id && (
            <div className="mt-8">
              <AcademyEyebrow>Knowledge check</AcademyEyebrow>
              <div className="mt-3">
                <TrainingQuiz quizId={lesson.quiz_id} onPass={() => setQuizPassed(true)} />
              </div>
              {!quizPassed && !quizAlreadyPassed && (
                <p className="mt-3 text-[12px]" style={{ color: "var(--academy-ink-soft)" }}>
                  Pass the knowledge check to complete this lesson.
                </p>
              )}
            </div>
          )}
        </div>

        <AcademyCard>
          <AcademyEyebrow>In this module</AcademyEyebrow>
          <div className="mt-2">
            {mod.lessons.map((l, i) => {
              const done = mod.completedLessonIds.has(l.id);
              const current = l.id === lesson.id;
              return (
                <button
                  key={l.id}
                  onClick={() => navigate(`/academy/lesson/${l.id}`)}
                  className="flex w-full items-center gap-2.5 py-3 text-left"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--academy-line)" }}
                >
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      flex: "0 0 auto",
                      background: done ? "var(--academy-pine)" : current ? "var(--academy-gold)" : "transparent",
                      border: done || current ? "none" : "1.5px solid var(--academy-line)",
                      color: "#fff",
                    }}
                  >
                    {done && <Check size={10} strokeWidth={4} />}
                  </span>
                  <span
                    className="flex-1 text-[13.5px]"
                    style={{ fontWeight: current ? 500 : 400, color: current ? "var(--academy-ink)" : "var(--academy-ink-soft)" }}
                  >
                    {l.title}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--academy-ink-soft)" }}>
                    {l.estimated_minutes || 10}m
                  </span>
                </button>
              );
            })}
          </div>
        </AcademyCard>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-20 flex flex-wrap items-center gap-3"
        style={{ background: "var(--academy-surface)", borderTop: "1px solid var(--academy-line)", padding: "14px 96px 14px 40px" }}
      >
        <button
          disabled={!previous}
          onClick={() => previous && navigate(`/academy/lesson/${previous.id}`)}
          className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] disabled:opacity-40"
          style={{ border: "1px solid var(--academy-line)", color: "var(--academy-pine)" }}
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <button
          disabled={!next}
          onClick={() => next && navigate(`/academy/lesson/${next.id}`)}
          className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] disabled:opacity-40"
          style={{ border: "1px solid var(--academy-line)", color: "var(--academy-pine)" }}
        >
          Next <ChevronRight size={14} />
        </button>
        <button
          onClick={markComplete}
          disabled={complete.isPending || (!!lesson.quiz_id && !isDone && !quizPassed && !quizAlreadyPassed)}
          className="ml-auto rounded-[10px] px-5 py-2.5 text-[13.5px] font-medium disabled:opacity-60"
          style={{ background: "var(--academy-gold)", color: "#fff" }}
        >
          {isDone ? "Completed · continue →" : "Mark complete and continue →"}
        </button>
      </div>
    </AcademyLayout>
  );
}
