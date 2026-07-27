import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Video,
  Download,
} from "lucide-react";
import { useTrainingLesson } from "@/hooks/useTrainingLessons";
import { useTrainingLessons } from "@/hooks/useTrainingLessons";
import { useMyTrainingProgressV2, useUpsertProgress, useAutoRollupProgress } from "@/hooks/useTrainingProgress";
import { TrainingQuiz } from "@/components/training/TrainingQuiz";
import { toast } from "sonner";

const TrainingLessonDetail = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { data: lesson, isLoading } = useTrainingLesson(lessonId);
  const moduleId = lesson?.module_id;
  const { data: allLessons } = useTrainingLessons(moduleId);
  const { data: progress } = useMyTrainingProgressV2();
  const upsertProgress = useUpsertProgress();
  const autoRollup = useAutoRollupProgress();
  const [notes, setNotes] = useState("");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const savedRef = useRef(false);

  const lessonProgress = (progress || []).find(p => p.lesson_id === lessonId);
  const isCompleted = lessonProgress?.status === "completed";

  // Auto-save last_viewed_at on mount
  useEffect(() => {
    if (lessonId && !savedRef.current) {
      savedRef.current = true;
      upsertProgress.mutate({ lesson_id: lessonId, status: lessonProgress?.status === "completed" ? "completed" : "in_progress" });
    }
  }, [lessonId]);

  // Reset saved ref on lesson change
  useEffect(() => {
    savedRef.current = false;
  }, [lessonId]);

  // Load notes from progress
  useEffect(() => {
    if (lessonProgress?.notes) setNotes(lessonProgress.notes);
  }, [lessonProgress?.notes]);

  // Nav helpers
  const sortedLessons = (allLessons || []).sort((a, b) => a.sort_order - b.sort_order);
  const currentIdx = sortedLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? sortedLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < sortedLessons.length - 1 ? sortedLessons[currentIdx + 1] : null;

  const modInfo = lesson?.training_modules_v2 as { id: string; title: string; phase_id: string; training_phases: { title: string } } | undefined;

  const handleToggleComplete = async () => {
    if (!lessonId) return;
    const newStatus = isCompleted ? "in_progress" : "completed";
    await upsertProgress.mutateAsync({ lesson_id: lessonId, status: newStatus, notes: notes || undefined });

    if (newStatus === "completed" && modInfo) {
      // Trigger auto-rollup for module and phase
      autoRollup.mutate({ lesson_id: lessonId, module_id: modInfo.id, phase_id: modInfo.phase_id });
    }

    toast.success(newStatus === "completed" ? "Lesson completed! ✅" : "Lesson marked as in progress");
  };

  const handleQuizPass = () => {
    if (!lessonId || isCompleted) return;
    // Auto-complete lesson on quiz pass
    handleToggleComplete();
  };

  const handleSaveNotes = async () => {
    if (!lessonId) return;
    await upsertProgress.mutateAsync({ lesson_id: lessonId, status: isCompleted ? "completed" : "in_progress", notes });
    toast.success("Notes saved");
  };

  const checklist = Array.isArray(lesson?.checklist_items) ? lesson.checklist_items as { label: string; id: string }[] : [];
  const files = Array.isArray(lesson?.file_attachments) ? lesson.file_attachments as { name: string; url: string }[] : [];

  if (isLoading) {
    return <DashboardLayout><Skeleton className="h-96" /></DashboardLayout>;
  }

  if (!lesson) {
    return <DashboardLayout><p className="text-muted-foreground">Lesson not found.</p></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 flex-wrap">
        <Link to="/training/library" className="hover:text-foreground">Library</Link>
        <span>/</span>
        {modInfo && (
          <>
            <Link to={`/training/phase/${modInfo.phase_id}`} className="hover:text-foreground">{modInfo.training_phases?.title}</Link>
            <span>/</span>
            <Link to={`/training/module/${modInfo.id}`} className="hover:text-foreground">{modInfo.title}</Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground font-medium">{lesson.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header */}
          <div className="bg-card rounded-xl shadow-card border border-border/50 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs capitalize">{lesson.lesson_type.replace("_", " ")}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {lesson.estimated_minutes} min</span>
              {isCompleted && <Badge className="bg-success/10 text-success border-0 text-xs">✓ Completed</Badge>}
            </div>
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">{lesson.title}</h1>
            {lesson.description && <p className="mt-2 text-[13.5px] text-muted-foreground">{lesson.description}</p>}
          </div>

          {/* Video */}
          {lesson.video_url && (
            <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
              <div className="aspect-video">
                <iframe
                  src={lesson.video_url}
                  className="w-full h-full"
                  allowFullScreen
                  title={lesson.title}
                />
              </div>
            </div>
          )}

          {/* External Link */}
          {lesson.external_url && (
            <div className="bg-card rounded-xl shadow-card border border-border/50 p-5">
              <a href={lesson.external_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline font-medium">
                <ExternalLink className="h-4 w-4" /> Open External Resource
              </a>
            </div>
          )}

          {/* Content Body */}
          {lesson.content_body && (
            <div className="bg-card rounded-xl shadow-card border border-border/50 p-6 prose prose-sm max-w-none text-card-foreground"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(lesson.content_body) }}
            />
          )}

          {/* Checklist */}
          {checklist.length > 0 && (
            <div className="bg-card rounded-xl shadow-card border border-border/50 p-6">
              <h3 className="font-semibold text-foreground mb-3">Checklist</h3>
              <div className="space-y-2">
                {checklist.map((item, i) => (
                  <label key={item.id || i} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={checkedItems[item.id || i] || false}
                      onCheckedChange={(v) => setCheckedItems(prev => ({ ...prev, [item.id || i]: !!v }))}
                    />
                    <span className="text-sm text-card-foreground">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div className="bg-card rounded-xl shadow-card border border-border/50 p-6">
              <h3 className="font-semibold text-foreground mb-3">Downloads</h3>
              <div className="space-y-2">
                {files.map((file, i) => (
                  <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Download className="h-4 w-4" /> {file.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Quiz */}
          {lesson.quiz_id && (
            <TrainingQuiz quizId={lesson.quiz_id} onPass={handleQuizPass} />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            {prevLesson ? (
              <Button variant="outline" onClick={() => navigate(`/training/lesson/${prevLesson.id}`)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Previous
              </Button>
            ) : <div />}
            {nextLesson ? (
              <Button onClick={() => navigate(`/training/lesson/${nextLesson.id}`)} className="gap-2">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate(`/training/module/${moduleId}`)} className="gap-2">
                Back to Module
              </Button>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Completion Toggle */}
          <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <h3 className="font-semibold text-sm text-foreground mb-3">Completion</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{isCompleted ? "Completed" : "Mark as complete"}</span>
              <Switch checked={isCompleted} onCheckedChange={handleToggleComplete} />
            </div>
          </div>

          {/* Notes */}
          <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <h3 className="font-semibold text-sm text-foreground mb-3">My Notes</h3>
            <Textarea
              placeholder="Take notes on this lesson..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              className="mb-2"
            />
            <Button variant="outline" size="sm" onClick={handleSaveNotes} disabled={upsertProgress.isPending}>
              Save Notes
            </Button>
          </div>

          {/* Lesson List */}
          <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <h3 className="font-semibold text-sm text-foreground mb-3">In this Module</h3>
            <div className="space-y-1">
              {sortedLessons.map((l, i) => {
                const lStatus = (progress || []).find(p => p.lesson_id === l.id)?.status || "not_started";
                const isCurrent = l.id === lessonId;
                return (
                  <Link
                    key={l.id}
                    to={`/training/lesson/${l.id}`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                      isCurrent ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className={`h-4 w-4 flex items-center justify-center rounded-full text-[10px] ${
                      lStatus === "completed" ? "bg-success/10 text-success" : "bg-muted"
                    }`}>
                      {lStatus === "completed" ? "✓" : i + 1}
                    </span>
                    <span className="truncate">{l.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TrainingLessonDetail;
