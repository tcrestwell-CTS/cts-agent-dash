import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Clock, ChevronRight, CheckCircle2, ArrowLeft, BookOpen } from "lucide-react";
import { useTrainingModuleV2 } from "@/hooks/useTrainingModulesV2";
import { useTrainingLessons } from "@/hooks/useTrainingLessons";
import { useMyTrainingProgressV2, useUpsertProgress } from "@/hooks/useTrainingProgress";
import { toast } from "sonner";

const TrainingModuleDetail = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { data: mod, isLoading } = useTrainingModuleV2(moduleId);
  const { data: lessons } = useTrainingLessons(moduleId);
  const { data: progress } = useMyTrainingProgressV2();
  const upsertProgress = useUpsertProgress();
  const [notes, setNotes] = useState("");

  const getLessonStatus = (lessonId: string) => {
    return (progress || []).find(p => p.lesson_id === lessonId)?.status || "not_started";
  };

  const requiredLessons = (lessons || []).filter(l => l.is_required);
  const completedRequired = requiredLessons.filter(l => getLessonStatus(l.id) === "completed").length;
  const allRequiredDone = requiredLessons.length > 0 && completedRequired === requiredLessons.length;
  const totalLessons = lessons?.length || 0;
  const completedLessons = (lessons || []).filter(l => getLessonStatus(l.id) === "completed").length;
  const modPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const moduleStatus = (progress || []).find(p => p.module_id === moduleId && !p.lesson_id)?.status || "not_started";

  const handleMarkComplete = async () => {
    if (!moduleId) return;
    await upsertProgress.mutateAsync({ module_id: moduleId, status: "completed", notes: notes || undefined });
    toast.success("Module marked as complete! 🎉");
  };

  // Get phase info from module join
  const phaseTitle = (mod as Record<string, unknown>)?.training_phases
    ? ((mod as Record<string, unknown>).training_phases as { title: string })?.title
    : undefined;

  if (isLoading) {
    return <DashboardLayout><Skeleton className="h-64" /></DashboardLayout>;
  }

  if (!mod) {
    return <DashboardLayout><p className="text-muted-foreground">Module not found.</p></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <Link to={mod.phase_id ? `/training/phase/${mod.phase_id}` : "/training/library"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> {phaseTitle || "Back"}
      </Link>

      <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden mb-6">
        <div className="bg-gradient-ocean p-8">
          <div className="flex items-center gap-2 mb-2">
            {mod.is_required && <Badge className="bg-accent/20 text-accent border-0 text-xs">Required</Badge>}
            {moduleStatus === "completed" && <Badge className="bg-success/20 text-success border-0 text-xs">✓ Completed</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">{mod.title}</h1>
          {mod.description && <p className="text-primary-foreground/70 mt-2 max-w-2xl">{mod.description}</p>}
        </div>
        <div className="p-6">
          <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> ~{mod.estimated_minutes} min</span>
            <span>{totalLessons} lessons</span>
            <span>{completedLessons} completed</span>
          </div>
          <Progress value={modPct} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">{modPct}% complete • {completedRequired}/{requiredLessons.length} required lessons done</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold text-foreground mb-2">Lessons</h2>
          {(lessons || []).map((lesson, idx) => {
            const status = getLessonStatus(lesson.id);
            return (
              <Link
                key={lesson.id}
                to={`/training/lesson/${lesson.id}`}
                className="flex items-center justify-between p-4 bg-card rounded-xl shadow-card border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                    status === "completed" ? "bg-success/10 text-success" :
                    status === "in_progress" ? "bg-accent/10 text-accent" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-card-foreground group-hover:text-primary transition-colors">{lesson.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize">{lesson.lesson_type.replace("_", " ")}</Badge>
                      <Clock className="h-3 w-3" /> {lesson.estimated_minutes} min
                      {lesson.is_required && <Badge variant="secondary" className="text-[10px] px-1 py-0">Required</Badge>}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </Link>
            );
          })}
        </div>

        <div className="space-y-6">
          {/* Mark Complete */}
          {moduleStatus !== "completed" && (
            <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
              <h3 className="font-semibold text-sm text-foreground mb-2">Module Completion</h3>
              {allRequiredDone ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3">All required lessons are complete. You can mark this module as done.</p>
                  <Button onClick={handleMarkComplete} disabled={upsertProgress.isPending} className="w-full">
                    Mark Module Complete
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Complete all {requiredLessons.length} required lessons to unlock completion.</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <h3 className="font-semibold text-sm text-foreground mb-2">My Notes</h3>
            <Textarea
              placeholder="Add your notes for this module..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TrainingModuleDetail;