import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Megaphone, BarChart3, Settings } from "lucide-react";
import { useTrainingPhases } from "@/hooks/useTrainingPhases";
import { useTrainingModulesV2 } from "@/hooks/useTrainingModulesV2";
import { useTrainingLessons } from "@/hooks/useTrainingLessons";
import { useAllAnnouncements } from "@/hooks/useTrainingAnnouncements";
import { AdminContentManager } from "@/components/training/AdminContentManager";
import { AdminAnnouncementsManager } from "@/components/training/AdminAnnouncementsManager";
import { AdminReporting } from "@/components/training/AdminReporting";

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
          <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
            Crestwell Travel Services
          </p>
          <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.025em] text-foreground">
            <Settings className="h-[17px] w-[17px] text-accent" />
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

      {/* Tabs for Admin Sections */}
      <Tabs defaultValue="content" className="space-y-6">
        <TabsList>
          <TabsTrigger value="content" className="gap-2"><BookOpen className="h-4 w-4" /> Content</TabsTrigger>
          <TabsTrigger value="reports" className="gap-2"><BarChart3 className="h-4 w-4" /> Reports</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2"><Megaphone className="h-4 w-4" /> Announcements</TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          <AdminContentManager />
        </TabsContent>
        <TabsContent value="reports">
          <AdminReporting />
        </TabsContent>
        <TabsContent value="announcements">
          <AdminAnnouncementsManager />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default TrainingAdmin;
