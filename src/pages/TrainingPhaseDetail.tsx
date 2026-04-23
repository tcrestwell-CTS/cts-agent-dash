import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, ChevronRight, CheckCircle2, ArrowLeft } from "lucide-react";
import { useTrainingPhase } from "@/hooks/useTrainingPhases";
import { useTrainingModulesV2 } from "@/hooks/useTrainingModulesV2";
import { useMyTrainingProgressV2 } from "@/hooks/useTrainingProgress";

const TrainingPhaseDetail = () => {
  const { phaseId } = useParams<{ phaseId: string }>();
  const { data: phase, isLoading } = useTrainingPhase(phaseId);
  const { data: modules } = useTrainingModulesV2(phaseId);
  const { data: progress } = useMyTrainingProgressV2();

  const getModuleStatus = (moduleId: string) => {
    return (progress || []).find(p => p.module_id === moduleId && !p.lesson_id)?.status || "not_started";
  };

  const completedCount = (modules || []).filter(m => getModuleStatus(m.id) === "completed").length;
  const totalCount = modules?.length || 0;
  const phasePct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return <DashboardLayout><Skeleton className="h-64" /></DashboardLayout>;
  }

  if (!phase) {
    return <DashboardLayout><p className="text-muted-foreground">Phase not found.</p></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <Link to="/training/library" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Library
      </Link>

      <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden mb-6">
        <div className="bg-gradient-ocean p-8">
          <p className="text-primary-foreground/60 text-sm font-medium">Phase {phase.sort_order}</p>
          <h1 className="text-2xl font-bold text-primary-foreground mt-1">{phase.title}</h1>
          {phase.description && <p className="text-primary-foreground/70 mt-2 max-w-2xl">{phase.description}</p>}
        </div>
        <div className="p-6">
          <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> ~{phase.estimated_minutes} minutes</span>
            <span>{totalCount} modules</span>
            <span>{completedCount} completed</span>
          </div>
          <Progress value={phasePct} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">{phasePct}% complete</p>
        </div>
      </div>

      <div className="space-y-3">
        {(modules || []).map(mod => {
          const status = getModuleStatus(mod.id);
          return (
            <Link
              key={mod.id}
              to={`/training/module/${mod.id}`}
              className="flex items-center justify-between p-5 bg-card rounded-xl shadow-card border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold ${
                  status === "completed" ? "bg-success/10 text-success" :
                  status === "in_progress" ? "bg-accent/10 text-accent" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : mod.sort_order}
                </div>
                <div>
                  <p className="font-semibold text-card-foreground group-hover:text-primary transition-colors">{mod.title}</p>
                  {mod.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{mod.description}</p>}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" /> {mod.estimated_minutes} min
                    {mod.is_required && <Badge variant="secondary" className="text-[10px] px-1 py-0">Required</Badge>}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

export default TrainingPhaseDetail;