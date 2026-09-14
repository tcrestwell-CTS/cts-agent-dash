import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { AcademyLayout, AcademyCard, AcademyEyebrow } from "@/components/academy/AcademyLayout";
import { useAcademyData, formatHours, FOUNDATION_MODULE_COUNT } from "@/hooks/useAcademy";

export default function AcademyCurriculum() {
  const navigate = useNavigate();
  const academy = useAcademyData();
  const cohort = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const nextLessonId = academy.resume?.lesson.id;

  return (
    <AcademyLayout>
      <header className="mb-8">
        <AcademyEyebrow>Foundations track · Cohort {cohort}</AcademyEyebrow>
        <h1 className="mt-1.5 text-[32px]" style={{ fontFamily: "Lora, Georgia, serif" }}>
          Curriculum
        </h1>
        <p className="mt-2 max-w-[62ch] text-[14.5px]" style={{ color: "var(--academy-ink-soft)" }}>
          Orientation through Module 6 is the foundational core — roughly 60 to 70 hours — taking you from your first day
          to booking-ready. Modules 7 to 13 are ongoing specialty education, open alongside the core rather than gated
          behind it. Supervised bookings begin during the foundational track, not after it.
        </p>
      </header>

      <div className="academy-grid">
        <div className="space-y-6">
          {academy.modules.map((m) => {
            const status = m.isElective
              ? m.isLocked
                ? "Unlocks after Module 4"
                : "CLIA pathway"
              : m.isComplete
                ? "Complete"
                : m.isStarted
                  ? `${m.completedCount} of ${m.totalCount} lessons`
                  : m.isLocked
                    ? "Locked"
                    : "Not started";

            return (
              <AcademyCard key={m.id}>
                <div className="flex items-center gap-3.5">
                  <span
                    className="flex items-center justify-center text-[12.5px] font-semibold"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      flex: "0 0 auto",
                      background: m.isComplete ? "var(--academy-pine)" : "transparent",
                      color: m.isComplete ? "#fff" : "var(--academy-ink-soft)",
                      border: m.isComplete ? "none" : "1.5px solid var(--academy-line)",
                    }}
                  >
                    {m.isComplete ? <Check size={14} strokeWidth={3} /> : m.sortOrder}
                  </span>
                  <h2 className="flex-1 text-[18.5px]">{m.title}</h2>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                    style={{
                      background: "var(--academy-parchment)",
                      border: "1px solid var(--academy-line)",
                      color: "var(--academy-ink-soft)",
                    }}
                  >
                    {status}
                  </span>
                </div>

                {m.description && (
                  <p className="mt-3 max-w-[70ch] text-[13.5px]" style={{ color: "var(--academy-ink-soft)" }}>
                    {m.description}
                  </p>
                )}

                <div className="mt-4" style={{ paddingLeft: 44 }}>
                  {m.lessons.map((l, i) => {
                    const done = m.completedLessonIds.has(l.id);
                    const isNext = l.id === nextLessonId;
                    return (
                      <button
                        key={l.id}
                        disabled={m.isLocked}
                        onClick={() => !m.isLocked && navigate(`/academy/lesson/${l.id}`)}
                        className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-55"
                        style={{ borderTop: i === 0 ? "none" : "1px solid var(--academy-line)" }}
                      >
                        <span
                          className="flex items-center justify-center"
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            flex: "0 0 auto",
                            background: done ? "var(--academy-pine)" : isNext ? "var(--academy-gold)" : "transparent",
                            border: done || isNext ? "none" : "1.5px solid var(--academy-line)",
                            color: "#fff",
                          }}
                        >
                          {done && <Check size={10} strokeWidth={4} />}
                        </span>
                        <span className="flex-1 text-[14px]">{l.title}</span>
                        <span className="text-[12.5px]" style={{ color: "var(--academy-ink-soft)" }}>
                          {l.estimated_minutes || 10} min
                        </span>
                      </button>
                    );
                  })}
                </div>
              </AcademyCard>
            );
          })}
        </div>

        <div className="space-y-6">
          <div style={{ background: "var(--academy-pine)", borderRadius: 14, padding: 24, color: "#fff" }}>
            <p className="academy-eyebrow" style={{ color: "rgba(255,255,255,0.6)" }}>
              Track summary
            </p>
            <h2 className="mt-2 text-[26px]" style={{ color: "#fff", fontFamily: "Lora, Georgia, serif" }}>
              {academy.completedFoundationCount} of {academy.foundations.length || FOUNDATION_MODULE_COUNT} complete
            </h2>
            <div
              className="mt-4"
              style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.22)", overflow: "hidden" }}
            >
              <div
                style={{
                  width: `${(academy.completedFoundationCount / (academy.foundations.length || FOUNDATION_MODULE_COUNT)) * 100}%`,
                  height: "100%",
                  background: "var(--academy-gold)",
                }}
              />
            </div>
            <p className="mt-4 text-[12.5px]" style={{ color: "rgba(255,255,255,0.75)" }}>
              {academy.totalLessons} lessons · about {formatHours(academy.totalMinutes)} total
              <br />
              Roughly {formatHours(academy.remainingMinutes)} remaining
            </p>
          </div>

          {academy.electives.map((e) => (
            <AcademyCard key={e.id}>
              <AcademyEyebrow>Specialty pathway</AcademyEyebrow>
              <h3 className="mt-1.5 text-[17px]">{e.title}</h3>
              <p className="mt-2 text-[13px]" style={{ color: "var(--academy-ink-soft)" }}>
                {e.isLocked
                  ? "Opens once its prerequisite module is complete."
                  : e.description ||
                    `${e.totalCount} lessons · about ${formatHours(e.minutes)}. Open now, alongside the foundational track.`}
              </p>
              <button
                onClick={() => e.lessons[0] && navigate(`/academy/lesson/${e.lessons[0].id}`)}
                disabled={e.isLocked || e.lessons.length === 0}
                className="mt-4 w-full rounded-[10px] px-4 py-2.5 text-[13px] font-medium disabled:opacity-50"
                style={{ border: "1px solid var(--academy-line)", color: "var(--academy-pine)" }}
              >
                Preview pathway
              </button>
            </AcademyCard>
          ))}
        </div>
      </div>
    </AcademyLayout>
  );
}
