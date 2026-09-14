import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { AcademyLayout, AcademyCard, AcademyEyebrow, useAdvisorName } from "@/components/academy/AcademyLayout";
import { WaypointTracker } from "@/components/academy/WaypointTracker";
import { MentorDrawer } from "@/components/academy/MentorDrawer";
import { CliaProgressCard } from "@/components/academy/CliaProgressCard";
import { useAcademyData } from "@/hooks/useAcademy";
import {
  useAcademyBadges,
  useAcademyMentor,
  useAcademyResources,
  useIssueEarnedCertificates,
} from "@/hooks/useAcademyExtras";
import { useActiveAnnouncements } from "@/hooks/useTrainingAnnouncements";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function relativeTime(iso: string | null): string {
  if (!iso) return "recently";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export default function AcademyDashboard() {
  const navigate = useNavigate();
  const { first } = useAdvisorName();
  const { user } = useAuth();
  const academy = useAcademyData();
  const { data: badges } = useAcademyBadges();
  const { data: announcements } = useActiveAnnouncements();
  const { data: resources } = useAcademyResources();
  const { data: mentor } = useAcademyMentor();
  const issue = useIssueEarnedCertificates();
  const [mentorOpen, setMentorOpen] = useState(false);

  const completedModuleIds = academy.modules.filter((m) => m.isComplete).map((m) => m.id);

  useEffect(() => {
    if (!academy.isLoading && completedModuleIds.length > 0) {
      issue.mutate(completedModuleIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academy.isLoading, completedModuleIds.join(",")]);

  const enrolled = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  const earnedBadges = (badges || []).filter((b) => b.earnedAt);

  return (
    <AcademyLayout>
      <MentorDrawer open={mentorOpen} onOpenChange={setMentorOpen} mentor={mentor ?? null} />

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 style={{ fontFamily: "Lora, Georgia, serif", fontSize: 32, lineHeight: 1.2 }}>
            Welcome back, <span style={{ color: "var(--academy-gold-deep)" }}>{first}</span>
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ color: "var(--academy-ink-soft)" }}>
            Advisor-in-Training{enrolled ? ` · Enrolled ${enrolled}` : ""}
          </p>
        </div>
        <div
          className="flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium"
          style={{ background: "var(--academy-surface)", border: "1px solid var(--academy-line)" }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--academy-gold)" }} />
          Module {academy.currentModuleOrder} in progress
        </div>
      </header>

      <div className="academy-grid">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          <AcademyCard>
            <AcademyEyebrow>Your route so far</AcademyEyebrow>
            <h2 className="mt-1.5 mb-7 text-[21px]">Foundational track progress</h2>
            <WaypointTracker modules={academy.foundations} />
          </AcademyCard>

          {academy.resume && (
            <div
              style={{ background: "var(--academy-pine)", borderRadius: 12, padding: 24, color: "#fff" }}
              className="flex flex-wrap items-center justify-between gap-5"
            >
              <div>
                <p
                  className="academy-eyebrow"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  Continue where you left off
                </p>
                <h3 className="mt-1.5 text-[19px]" style={{ color: "#fff" }}>
                  Module {academy.resume.module.sortOrder} · {academy.resume.module.title}
                </h3>
                <p className="mt-1.5 text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Lesson {academy.resume.lessonIndex + 1} of {academy.resume.module.totalCount} ·{" "}
                  {academy.resume.lesson.title} · ~{academy.resume.lesson.estimated_minutes || 10} min
                </p>
              </div>
              <button
                onClick={() => navigate(`/academy/lesson/${academy.resume!.lesson.id}`)}
                className="rounded-[10px] px-5 py-2.5 text-[13.5px] font-medium"
                style={{ background: "var(--academy-gold)", color: "#fff" }}
              >
                Resume lesson →
              </button>
            </div>
          )}

          <AcademyCard>
            <AcademyEyebrow>All modules</AcademyEyebrow>
            <h2 className="mt-1.5 mb-4 text-[21px]">Your curriculum</h2>
            <div>
              {academy.modules.map((m, i) => {
                const isCurrent = m.id === academy.currentModule?.id;
                const status = m.isElective
                  ? "CLIA pathway"
                  : m.isComplete
                    ? "Complete"
                    : m.isStarted
                      ? `${m.completedCount} of ${m.totalCount} lessons`
                      : "Not started";
                return (
                  <Link
                    to="/academy/curriculum"
                    key={m.id}
                    className="flex items-center gap-3.5 py-3.5"
                    style={{ borderTop: i === 0 ? "none" : "1px solid var(--academy-line)" }}
                  >
                    <span
                      className="flex items-center justify-center text-[12px] font-semibold"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        flex: "0 0 auto",
                        background: m.isComplete
                          ? "var(--academy-pine)"
                          : isCurrent
                            ? "rgba(214,158,46,0.16)"
                            : "transparent",
                        color: m.isComplete ? "#fff" : isCurrent ? "var(--academy-gold-deep)" : "var(--academy-ink-soft)",
                        border: m.isComplete
                          ? "none"
                          : isCurrent
                            ? "1.5px solid var(--academy-gold)"
                            : "1.5px dashed var(--academy-line)",
                      }}
                    >
                      {m.isComplete ? <Check size={14} strokeWidth={3} /> : m.sortOrder}
                    </span>
                    <span className="flex-1 text-[14.5px]">{m.title}</span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                      style={{
                        background: m.isComplete ? "rgba(44,82,130,0.09)" : "var(--academy-parchment)",
                        color: m.isComplete ? "var(--academy-pine)" : "var(--academy-ink-soft)",
                        border: "1px solid var(--academy-line)",
                      }}
                    >
                      {status}
                    </span>
                  </Link>
                );
              })}
            </div>
          </AcademyCard>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-6">
          <AcademyCard>
            <AcademyEyebrow>Your mentor</AcademyEyebrow>
            <div className="mt-3.5 flex items-center gap-3">
              <span
                className="flex items-center justify-center text-[13px] font-semibold"
                style={{ width: 42, height: 42, borderRadius: 999, background: "var(--academy-pine)", color: "#fff" }}
              >
                {(mentor?.fullName || "CTN")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div>
                <p className="text-[14.5px] font-medium">{mentor?.fullName || "Mentor pending"}</p>
                <p className="text-[12.5px]" style={{ color: "var(--academy-ink-soft)" }}>
                  {mentor?.title || "Assignment in progress"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[12.5px]" style={{ color: "var(--academy-ink-soft)" }}>
              {mentor?.officeHours || "Office hours announced once you are paired."}
            </p>
            <button
              onClick={() => setMentorOpen(true)}
              className="mt-4 w-full rounded-[10px] px-4 py-2.5 text-[13px] font-medium"
              style={{ border: "1px solid var(--academy-line)", color: "var(--academy-pine)" }}
            >
              Message mentor
            </button>
          </AcademyCard>

          <AcademyCard>
            <div className="flex items-baseline justify-between">
              <AcademyEyebrow>Badges earned</AcademyEyebrow>
              <span className="text-[12.5px]" style={{ color: "var(--academy-ink-soft)" }}>
                {earnedBadges.length} of {(badges || []).length}
              </span>
            </div>
            <TooltipProvider>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {(badges || []).map((b) => {
                  const earned = !!b.earnedAt;
                  return (
                    <Tooltip key={b.id}>
                      <TooltipTrigger asChild>
                        <span
                          className="flex items-center justify-center text-[15px] font-semibold"
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 999,
                            background: earned ? "rgba(214,158,46,0.12)" : "transparent",
                            border: earned ? "2px solid var(--academy-gold)" : "1.5px dashed var(--academy-line)",
                            color: earned ? "var(--academy-gold-deep)" : "var(--academy-ink-soft)",
                            fontFamily: "Lora, Georgia, serif",
                          }}
                        >
                          {earned ? (b.icon || b.title?.[0] || "★") : "?"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-[12.5px] font-medium">{b.title}</p>
                        <p className="text-[11.5px] opacity-80">{b.description || "Complete the module to earn this."}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </AcademyCard>

          <CliaProgressCard />


          <AcademyCard>
            <AcademyEyebrow>Announcements</AcademyEyebrow>
            <div className="mt-3.5 space-y-3.5">
              {(announcements || []).slice(0, 4).map((a) => (
                <div key={a.id} style={{ borderLeft: "2px solid var(--academy-gold)", paddingLeft: 12 }}>
                  <p className="text-[13.5px] font-medium">{a.title}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--academy-ink-soft)" }}>
                    Posted {relativeTime(a.created_at)}
                  </p>
                </div>
              ))}
              {(announcements || []).length === 0 && (
                <p className="text-[13px]" style={{ color: "var(--academy-ink-soft)" }}>
                  Nothing new from the education team this week.
                </p>
              )}
            </div>
          </AcademyCard>

          <AcademyCard>
            <AcademyEyebrow>Resource library</AcademyEyebrow>
            <div className="mt-2">
              {(resources || []).slice(0, 3).map((r, i) => (
                <Link
                  key={r.id}
                  to={`/academy/library?category=${encodeURIComponent(r.category)}`}
                  className="flex items-center justify-between gap-3 py-3 text-[13.5px]"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--academy-line)" }}
                >
                  <span>{r.title}</span>
                  <ArrowRight size={14} style={{ color: "var(--academy-gold-deep)", flex: "0 0 auto" }} />
                </Link>
              ))}
            </div>
          </AcademyCard>
        </div>
      </div>
    </AcademyLayout>
  );
}
