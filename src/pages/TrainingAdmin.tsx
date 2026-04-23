import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Users, Award, BarChart3, Megaphone, Plus, Settings } from "lucide-react";
import { useTrainingPhases } from "@/hooks/useTrainingPhases";
import { useTrainingModulesV2 } from "@/hooks/useTrainingModulesV2";
import { useTrainingLessons } from "@/hooks/useTrainingLessons";
import { useAllAnnouncements } from "@/hooks/useTrainingAnnouncements";

const TrainingAdmin = () => {
  const { data: phases, isLoading } = useTrainingPhases();
  const { data: modules } = useTrainingModulesV2();
  const { data: lessons } = useTrainingLessons();
  const { data: announcements } = useAllAnnouncements();

  if (isLoading) {
    return <DashboardLayout><div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <Settings className="h-8 w-8 text-accent" />
            Training Admin
          </h1>
          <p className="text-muted-foreground mt-1">Manage training content, track progress, and publish announcements</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Phases</span>
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">{phases?.length || 0}</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Modules</span>
            <BookOpen className="h-5 w-5 text-accent" />
          </div>
          <p className="text-3xl font-bold text-foreground">{modules?.length || 0}</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Lessons</span>
            <BookOpen className="h-5 w-5 text-success" />
          </div>
          <p className="text-3xl font-bold text-foreground">{lessons?.length || 0}</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Announcements</span>
            <Megaphone className="h-5 w-5 text-accent" />
          </div>
          <p className="text-3xl font-bold text-foreground">{announcements?.length || 0}</p>
        </div>
      </div>

      {/* Content Overview */}
      <div className="bg-card rounded-xl shadow-card border border-border/50 p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Content Overview</h2>
        <div className="space-y-3">
          {(phases || []).map(phase => {
            const phaseModules = (modules || []).filter(m => m.phase_id === phase.id);
            const phaseLessons = (lessons || []).filter(l => phaseModules.some(m => m.id === l.module_id));
            return (
              <div key={phase.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                <div>
                  <p className="font-semibold text-card-foreground">{phase.title}</p>
                  <p className="text-xs text-muted-foreground">{phaseModules.length} modules • {phaseLessons.length} lessons • {phase.status}</p>
                </div>
                <Link to={`/training/phase/${phase.id}`}>
                  <Button variant="outline" size="sm">View</Button>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Announcements */}
      <div className="bg-card rounded-xl shadow-card border border-border/50 p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Announcements</h2>
        {(announcements || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {(announcements || []).slice(0, 5).map(ann => (
              <div key={ann.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div>
                  <p className="font-medium text-sm text-card-foreground">{ann.title}</p>
                  <p className="text-xs text-muted-foreground">{ann.status} • {ann.audience} • {ann.is_pinned ? "📌 Pinned" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TrainingAdmin;