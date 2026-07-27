import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Lock,
  Video,
  FileText,
  ExternalLink,
  Download,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import { useTrainingPhases } from "@/hooks/useTrainingPhases";
import { useTrainingModulesV2 } from "@/hooks/useTrainingModulesV2";
import { useTrainingLessons } from "@/hooks/useTrainingLessons";
import { useMyTrainingProgressV2 } from "@/hooks/useTrainingProgress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const LESSON_TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  video: Video,
  text: FileText,
  external_link: ExternalLink,
  download: Download,
  sop: FileText,
  checklist: ListChecks,
};

const TrainingLibrary = () => {
  const { data: phases, isLoading } = useTrainingPhases();
  const { data: modules } = useTrainingModulesV2();
  const { data: lessons } = useTrainingLessons();
  const { data: progress } = useMyTrainingProgressV2();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed" | "not_started">("all");
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});

  const togglePhase = (id: string) => setOpenPhases(prev => ({ ...prev, [id]: !prev[id] }));

  const getLessonStatus = (lessonId: string) => {
    return (progress || []).find(p => p.lesson_id === lessonId)?.status || "not_started";
  };
  const getModuleStatus = (moduleId: string) => {
    return (progress || []).find(p => p.module_id === moduleId && !p.lesson_id)?.status || "not_started";
  };

  const filteredPhases = (phases || []).filter(phase => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (phase.title.toLowerCase().includes(q)) return true;
    const phaseModules = (modules || []).filter(m => m.phase_id === phase.id);
    return phaseModules.some(m => m.title.toLowerCase().includes(q));
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
          Crestwell Travel Services
        </p>
        <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Training Library</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Browse all phases, modules, and lessons</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search training content..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "in_progress", "completed", "not_started"] as const).map(f => (
            <Button key={f} variant={statusFilter === f ? "outline" : "ghost"} size="sm" onClick={() => setStatusFilter(f)}>
              {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f === "completed" ? "Completed" : "Not Started"}
            </Button>
          ))}
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {filteredPhases.map(phase => {
          const phaseModules = (modules || []).filter(m => m.phase_id === phase.id);
          const isOpen = openPhases[phase.id] ?? false;
          const completedInPhase = phaseModules.filter(m => getModuleStatus(m.id) === "completed").length;
          const phasePct = phaseModules.length > 0 ? Math.round((completedInPhase / phaseModules.length) * 100) : 0;

          return (
            <Collapsible key={phase.id} open={isOpen} onOpenChange={() => togglePhase(phase.id)}>
              <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-gradient-ocean flex items-center justify-center text-primary-foreground font-bold">
                        {phase.sort_order}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-card-foreground">{phase.title}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{phaseModules.length} modules</span>
                          <span>•</span>
                          <span>{phase.estimated_minutes} min</span>
                          <span>•</span>
                          <span>{completedInPhase}/{phaseModules.length} complete</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-24">
                        <Progress value={phasePct} className="h-2" />
                      </div>
                      {isOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border/50 px-5 py-3 space-y-2">
                    {phaseModules.map(mod => {
                      const modStatus = getModuleStatus(mod.id);
                      if (statusFilter !== "all" && modStatus !== statusFilter) return null;
                      const modLessons = (lessons || []).filter(l => l.module_id === mod.id);
                      const completedLessons = modLessons.filter(l => getLessonStatus(l.id) === "completed").length;
                      const modPct = modLessons.length > 0 ? Math.round((completedLessons / modLessons.length) * 100) : 0;

                      return (
                        <Link
                          key={mod.id}
                          to={`/training/module/${mod.id}`}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded flex items-center justify-center text-sm font-medium ${
                              modStatus === "completed" ? "bg-success/10 text-success" :
                              modStatus === "in_progress" ? "bg-accent/10 text-accent" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {modStatus === "completed" ? <CheckCircle2 className="h-4 w-4" /> : mod.sort_order}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-card-foreground group-hover:text-primary transition-colors">{mod.title}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />{mod.estimated_minutes} min
                                <span>•</span>
                                {modLessons.length} lessons
                                {mod.is_required && <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">Required</Badge>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-16"><Progress value={modPct} className="h-1.5" /></div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

export default TrainingLibrary;