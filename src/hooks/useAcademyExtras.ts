import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ── Resource library ──────────────────────────────────────────────────── */

export const RESOURCE_CATEGORIES = ["All", "Handbooks", "Templates", "Suppliers", "Recordings"] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export function useAcademyResources() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_resources")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

/* ── Badges ────────────────────────────────────────────────────────────── */

export function useAcademyBadges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-badges", user?.id],
    queryFn: async () => {
      const [all, mine] = await Promise.all([
        supabase.from("training_badges").select("*").order("created_at", { ascending: true }),
        supabase.from("training_user_badges").select("badge_id, earned_at").eq("user_id", user!.id),
      ]);
      if (all.error) throw all.error;
      if (mine.error) throw mine.error;
      const earned = new Map((mine.data || []).map((r) => [r.badge_id, r.earned_at]));
      return (all.data || []).map((b) => ({
        ...b,
        earnedAt: earned.get(b.id) ?? null,
      }));
    },
    enabled: !!user,
  });
}

/* ── Certificates ──────────────────────────────────────────────────────── */

export interface AcademyCertificate {
  id: string;
  name: string;
  description: string | null;
  credential_prefix: string;
  required_module_ids: string[];
  requirement_notes: string[];
  sort_order: number;
}

export function useAcademyCertificates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-certificates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_certificates")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []).map((c) => ({
        ...c,
        required_module_ids: (c.required_module_ids || []) as string[],
        requirement_notes: Array.isArray(c.requirement_notes) ? (c.requirement_notes as string[]) : [],
      })) as AcademyCertificate[];
    },
    enabled: !!user,
  });
}

export function useMyAcademyCertificates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-user-certificates", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_user_certificates")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

/** Deterministic four-digit suffix so a credential ID is stable per advisor. */
function credentialSuffix(userId: string, certificateId: string): string {
  const seed = `${userId}:${certificateId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9000;
  }
  return String(1000 + hash);
}

/**
 * Issues any certificate whose required modules are all complete and which the
 * advisor does not already hold. Safe to call repeatedly.
 */
export function useIssueEarnedCertificates() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (completedModuleIds: string[]) => {
      if (!user) return [] as string[];
      const done = new Set(completedModuleIds);

      const [{ data: catalogue }, { data: held }] = await Promise.all([
        supabase.from("training_certificates").select("id, credential_prefix, required_module_ids"),
        supabase.from("training_user_certificates").select("certificate_id").eq("user_id", user.id),
      ]);
      const heldIds = new Set((held || []).map((r) => r.certificate_id));

      const toIssue = (catalogue || []).filter((c) => {
        if (heldIds.has(c.id)) return false;
        const required = (c.required_module_ids || []) as string[];
        return required.length > 0 && required.every((id) => done.has(id));
      });

      if (toIssue.length === 0) return [] as string[];

      const rows = toIssue.map((c) => ({
        user_id: user.id,
        certificate_id: c.id,
        credential_id: `${c.credential_prefix}-${credentialSuffix(user.id, c.id)}`,
      }));

      const { error } = await supabase.from("training_user_certificates").insert(rows);
      if (error && error.code !== "23505") throw error;
      return toIssue.map((c) => c.id);
    },
    onSuccess: (issued) => {
      if (issued && issued.length > 0) {
        qc.invalidateQueries({ queryKey: ["academy-user-certificates"] });
      }
    },
  });
}

/* ── Mentor + messages ─────────────────────────────────────────────────── */

export function useAcademyMentor() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-mentor", user?.id],
    queryFn: async () => {
      const { data: assignment } = await supabase
        .from("mentor_assignments")
        .select("mentor_user_id, notes")
        .eq("mentee_user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!assignment) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, full_name, job_title, avatar_url")
        .eq("user_id", assignment.mentor_user_id)
        .maybeSingle();

      return {
        userId: assignment.mentor_user_id,
        fullName: profile?.full_name || "Your mentor",
        title: profile?.job_title || "Advisor mentor",
        officeHours: assignment.notes || "Office hours: Tuesdays and Thursdays, 2–4pm ET",
      };
    },
    enabled: !!user,
  });
}

export function useMentorThread(mentorUserId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-mentor-thread", user?.id, mentorUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user!.id},recipient_id.eq.${mentorUserId}),and(sender_id.eq.${mentorUserId},recipient_id.eq.${user!.id})`,
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!mentorUserId,
  });
}

export function useSendMentorMessage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ mentorUserId, body }: { mentorUserId: string; body: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("agent_messages").insert([
        {
          sender_id: user.id,
          recipient_id: mentorUserId,
          message: body,
          channel: "academy",
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academy-mentor-thread"] }),
  });
}
