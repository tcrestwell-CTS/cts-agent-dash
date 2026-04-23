import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap,
  Clock,
  Award,
  BookOpen,
  ChevronRight,
  Megaphone,
  Library,
  Settings,
  Play,
} from "lucide-react";
import { useTrainingPhases } from "@/hooks/useTrainingPhases";
import { useTrainingModulesV2 } from "@/hooks/useTrainingModulesV2";
import { useMyTrainingProgressV2 } from "@/hooks/useTrainingProgress";
import { useActiveAnnouncements } from "@/hooks/useTrainingAnnouncements";
import { useMyBadges } from "@/hooks/useTrainingBadges";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";

const Training = () => {
  const { user } = useAuth();
  const { data: phases, isLoading: phasesLoading } = useTrainingPhases();
  const { data: modules } = useTrainingModulesV2();
  const { data: progress, isLoading: progressLoading } = useMyTrainingProgressV2();
  const { data: announcements } = useActiveAnnouncements();
  const { data: badges } = useMyBadges();
  const { isAdmin } = usePermissions();

  const loading = phasesLoading || progressLoading;

  const userName = user?.user_metadata?.full_name?.split(" ")[0] || "Agent";

  // Calculate overall progress
  const lessonProgress = (progress || []).filter(p => p.lesson_id);
  const completedLessons = lessonProgress.filter(p => p.status === "completed").length;
  const inProgressLessons = lessonProgress.filter(p => p.status === "in_progress").length;
  const totalModules = modules?.length || 0;
  const moduleProgress = (progress || []).filter(p => p.module_id && !p.lesson_id);
  const completedModules = moduleProgress.filter(p => p.status === "completed").length;
  const overallPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  // Find current phase (first non-completed)
  const currentPhase = (phases || []).find(phase => {
    const phaseModules = (modules || []).filter(m => m.phase_id === phase.id);
    const allCompleted = phaseModules.length > 0 && phaseModules.every(m => {
      const mp = moduleProgress.find(p => p.module_id === m.id);
      return mp?.status === "completed";
    });
    return !allCompleted;
  });

  // Find next recommended lesson
  const getNextLesson = () => {
    const inProgressItem = (progress || []).find(p => p.lesson_id && p.status === "in_progress");
    return inProgressItem;
  };
  const nextLesson = getNextLesson();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-accent" />
            Crestwell Academy
          </h1>
          <p className="text-muted-foreground mt-1">Welcome back, {userName}! Continue your training journey.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/training/library">
            <Button variant="outline" className="gap-2">
              <Library className="h-4 w-4" />
              Training Library
            </Button>
          </Link>
          {isAdmin && (
            <Link to="/training/admin">
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <div className="mb-6 space-y-3">
          {announcements.filter(a => a.is_pinned).slice(0, 2).map(ann => (
            <div key={ann.id} className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-start gap-3">
              <Megaphone className="h-5 w-5 text-accent mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-foreground">{ann.title}</p>
                {ann.body && <p className="text-sm text-muted-foreground mt-1">{ann.body}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Overall Progress</span>
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">{overallPct}%</p>
          <Progress value={overallPct} className="h-2 mt-2" />
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Modules Completed</span>
            <Award className="h-5 w-5 text-accent" />
          </div>
          <p className="text-3xl font-bold text-foreground">{completedModules}<span className="text-lg text-muted-foreground">/{totalModules}</span></p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Lessons Completed</span>
            <BookOpen className="h-5 w-5 text-success" />
          </div>
          <p className="text-3xl font-bold text-foreground">{completedLessons}</p>
          <p className="text-xs text-muted-foreground mt-1">{inProgressLessons} in progress</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Badges Earned</span>
            <Award className="h-5 w-5 text-accent" />
          </div>
          <p className="text-3xl font-bold text-foreground">{badges?.length || 0}</p>
        </div>
      </div>

      {/* Current Phase & Next Step */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
          <div className="bg-gradient-ocean p-6">
            <h2 className="text-lg font-semibold text-primary-foreground">Current Phase</h2>
            <p className="text-primary-foreground/80 text-2xl font-bold mt-1">
              {currentPhase?.title || "All Phases Complete! 🎉"}
            </p>
            {currentPhase?.description && (
              <p className="text-primary-foreground/60 text-sm mt-2 max-w-xl">{currentPhase.description}</p>
            )}
          </div>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Modules in this Phase</h3>
            <div className="space-y-2">
              {(modules || [])
                .filter(m => m.phase_id === currentPhase?.id)
                .map(mod => {
                  const mp = moduleProgress.find(p => p.module_id === mod.id);
                  const status = mp?.status || "not_started";
                  return (
                    <Link
                      key={mod.id}
                      to={`/training/module/${mod.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm ${
                          status === "completed" ? "bg-success/10 text-success" :
                          status === "in_progress" ? "bg-accent/10 text-accent" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {status === "completed" ? "✓" : mod.sort_order}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-card-foreground">{mod.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>{mod.estimated_minutes} min</span>
                            {mod.is_required && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Required</Badge>}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Resume */}
          {nextLesson && (
            <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resume Learning</h3>
              <Link
                to={`/training/lesson/${nextLesson.lesson_id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Play className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-card-foreground">Continue lesson</p>
                  <p className="text-xs text-muted-foreground">Pick up where you left off</p>
                </div>
              </Link>
            </div>
          )}

          {/* Badges */}
          <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Earned Badges</h3>
            {badges && badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {badges.map(b => (
                  <div key={b.id} className="flex items-center gap-2 bg-accent/10 rounded-full px-3 py-1.5">
                    <span className="text-lg">{(b.training_badges as { icon: string } | null)?.icon || "🏆"}</span>
                    <span className="text-xs font-medium text-foreground">{(b.training_badges as { title: string } | null)?.title || "Badge"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Complete modules and phases to earn badges!</p>
            )}
          </div>

          {/* Quick Links */}
          <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link to="/training/library" className="flex items-center gap-2 text-sm text-card-foreground hover:text-primary transition-colors">
                <Library className="h-4 w-4" /> Full Training Library
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* All Phases Overview */}
      <div className="bg-card rounded-xl shadow-card border border-border/50 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">All Phases</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(phases || []).map(phase => {
            const phaseModules = (modules || []).filter(m => m.phase_id === phase.id);
            const completedInPhase = phaseModules.filter(m => {
              const mp = moduleProgress.find(p => p.module_id === m.id);
              return mp?.status === "completed";
            }).length;
            const phasePct = phaseModules.length > 0 ? Math.round((completedInPhase / phaseModules.length) * 100) : 0;
            return (
              <Link
                key={phase.id}
                to={`/training/phase/${phase.id}`}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-colors group"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                  {phase.sort_order}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-card-foreground group-hover:text-primary transition-colors">{phase.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={phasePct} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground shrink-0">{completedInPhase}/{phaseModules.length}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Training;
