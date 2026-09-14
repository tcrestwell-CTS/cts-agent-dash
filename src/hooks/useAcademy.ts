import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const ACADEMY_TRACK = "academy";
export const FOUNDATION_MODULE_COUNT = 7;

/** Short names used under each waypoint on the route tracker. */
export const MODULE_SHORT_NAMES: Record<number, string> = {
  1: "Orientation",
  2: "Industry",
  3: "Compliance",
  4: "Sales",
  5: "Quoting",
  6: "CRM",
  7: "Payments",
  8: "Cruise",
  9: "Resorts",
  10: "Specialty",
  11: "Groups",
  12: "Marketing",
  13: "Service",
  14: "Growth",
  15: "Capstone",
};

export interface AcademyLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  content_body: string | null;
  video_url: string | null;
  external_url: string | null;
  sort_order: number;
  estimated_minutes: number | null;
  is_required: boolean;
  content_source_name: string | null;
  content_source_updated_at: string | null;
}

export interface AcademyModuleState {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isElective: boolean;
  unlockAfterModuleId: string | null;
  lessons: AcademyLesson[];
  completedLessonIds: Set<string>;
  completedCount: number;
  totalCount: number;
  minutes: number;
  isComplete: boolean;
  isStarted: boolean;
  isLocked: boolean;
  badgeId: string | null;
  nextLessonId: string | null;
}

function useAcademyPhase() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-phase"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_phases")
        .select("*")
        .eq("track", ACADEMY_TRACK)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

function useAcademyModules(phaseId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-modules", phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_modules_v2")
        .select("*")
        .eq("phase_id", phaseId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!phaseId,
  });
}

function useAcademyLessons(moduleIds: string[]) {
  const { user } = useAuth();
  const key = moduleIds.join(",");
  return useQuery({
    queryKey: ["academy-lessons", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_lessons")
        .select("*")
        .in("module_id", moduleIds)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as unknown as AcademyLesson[];
    },
    enabled: !!user && moduleIds.length > 0,
  });
}

export function useAcademyProgress() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-progress", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_user_progress")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export interface AcademyState {
  isLoading: boolean;
  phaseId: string | null;
  modules: AcademyModuleState[];
  foundations: AcademyModuleState[];
  electives: AcademyModuleState[];
  completedFoundationCount: number;
  /** 1-based index of the module the advisor is currently working in. */
  currentModuleOrder: number;
  currentModule: AcademyModuleState | null;
  resume: { module: AcademyModuleState; lesson: AcademyLesson; lessonIndex: number } | null;
  totalLessons: number;
  totalMinutes: number;
  remainingMinutes: number;
}

export function useAcademyData(): AcademyState {
  const { data: phase, isLoading: phaseLoading } = useAcademyPhase();
  const { data: modules, isLoading: modulesLoading } = useAcademyModules(phase?.id);
  const moduleIds = useMemo(() => (modules || []).map((m) => m.id), [modules]);
  const { data: lessons, isLoading: lessonsLoading } = useAcademyLessons(moduleIds);
  const { data: progress, isLoading: progressLoading } = useAcademyProgress();

  return useMemo(() => {
    const isLoading = phaseLoading || modulesLoading || lessonsLoading || progressLoading;
    const completedLessonIds = new Set(
      (progress || []).filter((p) => p.lesson_id && p.status === "completed").map((p) => p.lesson_id as string),
    );

    const built: AcademyModuleState[] = (modules || []).map((m) => {
      const moduleLessons = (lessons || []).filter((l) => l.module_id === m.id);
      const done = moduleLessons.filter((l) => completedLessonIds.has(l.id));
      const next = moduleLessons.find((l) => !completedLessonIds.has(l.id));
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        sortOrder: m.sort_order,
        isElective: !m.is_required,
        unlockAfterModuleId: (m as { unlock_after_module_id?: string | null }).unlock_after_module_id ?? null,
        lessons: moduleLessons,
        completedLessonIds: new Set(done.map((l) => l.id)),
        completedCount: done.length,
        totalCount: moduleLessons.length,
        minutes: moduleLessons.reduce((sum, l) => sum + (l.estimated_minutes || 0), 0),
        isComplete: moduleLessons.length > 0 && done.length === moduleLessons.length,
        isStarted: done.length > 0,
        isLocked: false,
        badgeId: m.badge_id ?? null,
        nextLessonId: next?.id ?? null,
      };
    });

    // Unlocking: foundations run in order; electives wait on their gate module.
    const byId = new Map(built.map((m) => [m.id, m]));
    built.forEach((m) => {
      if (m.isElective) {
        const gate = m.unlockAfterModuleId ? byId.get(m.unlockAfterModuleId) : null;
        m.isLocked = gate ? !gate.isComplete : false;
        return;
      }
      const previous = built.filter((o) => !o.isElective && o.sortOrder < m.sortOrder);
      m.isLocked = previous.some((o) => !o.isComplete);
    });

    const foundations = built.filter((m) => !m.isElective).sort((a, b) => a.sortOrder - b.sortOrder);
    const electives = built.filter((m) => m.isElective).sort((a, b) => a.sortOrder - b.sortOrder);
    const completedFoundationCount = foundations.filter((m) => m.isComplete).length;

    const currentModule =
      foundations.find((m) => !m.isComplete) || foundations[foundations.length - 1] || null;
    const currentModuleOrder = currentModule?.sortOrder ?? 1;

    let resume: AcademyState["resume"] = null;
    const resumeModule = foundations.find((m) => !m.isComplete) || electives.find((m) => !m.isComplete && !m.isLocked);
    if (resumeModule) {
      const lessonIndex = resumeModule.lessons.findIndex((l) => !resumeModule.completedLessonIds.has(l.id));
      if (lessonIndex >= 0) {
        resume = { module: resumeModule, lesson: resumeModule.lessons[lessonIndex], lessonIndex };
      }
    }

    const totalLessons = foundations.reduce((s, m) => s + m.totalCount, 0);
    const totalMinutes = foundations.reduce((s, m) => s + m.minutes, 0);
    const remainingMinutes = foundations.reduce(
      (s, m) => s + m.lessons.filter((l) => !completedLessonIds.has(l.id)).reduce((x, l) => x + (l.estimated_minutes || 0), 0),
      0,
    );

    return {
      isLoading,
      phaseId: phase?.id ?? null,
      modules: built,
      foundations,
      electives,
      completedFoundationCount,
      currentModuleOrder,
      currentModule,
      resume,
      totalLessons,
      totalMinutes,
      remainingMinutes,
    };
  }, [phase, modules, lessons, progress, phaseLoading, modulesLoading, lessonsLoading, progressLoading]);
}

/** Marks an Academy lesson complete and rolls the result up to the module. */
export function useCompleteAcademyLesson() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      lessonId,
      moduleId,
      phaseId,
    }: {
      lessonId: string;
      moduleId: string;
      phaseId: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const now = new Date().toISOString();

      const { data: existing } = await supabase
        .from("training_user_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      const row = {
        user_id: user.id,
        lesson_id: lessonId,
        module_id: moduleId,
        phase_id: phaseId,
        status: "completed" as const,
        percent_complete: 100,
        completed_at: now,
        last_viewed_at: now,
      };

      if (existing) {
        const { error } = await supabase.from("training_user_progress").update(row).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_user_progress").insert([row]);
        if (error) throw error;
      }

      // Module rollup + badge award when every lesson in the module is done.
      const { data: moduleLessons } = await supabase
        .from("training_lessons")
        .select("id")
        .eq("module_id", moduleId);
      const ids = (moduleLessons || []).map((l) => l.id);
      const { data: doneRows } = await supabase
        .from("training_user_progress")
        .select("lesson_id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .in("lesson_id", ids);
      const doneIds = new Set((doneRows || []).map((r) => r.lesson_id));

      if (ids.length > 0 && ids.every((id) => doneIds.has(id))) {
        const { data: existingMod } = await supabase
          .from("training_user_progress")
          .select("id")
          .eq("user_id", user.id)
          .eq("module_id", moduleId)
          .is("lesson_id", null)
          .maybeSingle();

        const modRow = {
          user_id: user.id,
          module_id: moduleId,
          phase_id: phaseId,
          status: "completed" as const,
          percent_complete: 100,
          completed_at: now,
          last_viewed_at: now,
        };
        if (existingMod) {
          await supabase.from("training_user_progress").update(modRow).eq("id", existingMod.id);
        } else {
          await supabase.from("training_user_progress").insert([modRow]);
        }

        const { data: badge } = await supabase
          .from("training_badges")
          .select("id")
          .eq("criteria_type", "module")
          .eq("criteria_id", moduleId)
          .maybeSingle();

        if (badge) {
          const { data: earned } = await supabase
            .from("training_user_badges")
            .select("id")
            .eq("user_id", user.id)
            .eq("badge_id", badge.id)
            .maybeSingle();
          if (!earned) {
            await supabase.from("training_user_badges").insert([{ user_id: user.id, badge_id: badge.id }]);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academy-progress"] });
      qc.invalidateQueries({ queryKey: ["training-progress-v2"] });
      qc.invalidateQueries({ queryKey: ["academy-badges"] });
      qc.invalidateQueries({ queryKey: ["academy-user-certificates"] });
    },
  });
}

/** Records that a lesson was opened, without completing it. */
export function useTouchAcademyLesson() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ lessonId, moduleId, phaseId }: { lessonId: string; moduleId: string; phaseId: string }) => {
      if (!user) return;
      const now = new Date().toISOString();
      const { data: existing } = await supabase
        .from("training_user_progress")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();
      if (existing) {
        if (existing.status !== "completed") {
          await supabase
            .from("training_user_progress")
            .update({ last_viewed_at: now, status: "in_progress" })
            .eq("id", existing.id);
        }
        return;
      }
      await supabase.from("training_user_progress").insert([
        {
          user_id: user.id,
          lesson_id: lessonId,
          module_id: moduleId,
          phase_id: phaseId,
          status: "in_progress" as const,
          percent_complete: 25,
          last_viewed_at: now,
        },
      ]);
    },
  });
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 1) return `${minutes} min`;
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)} hours`;
}
