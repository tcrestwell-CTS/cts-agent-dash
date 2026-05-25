import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CircleTier = "circle" | "premier" | "founders_society";
export type CircleStatus = "active" | "unsubscribed" | "cancelled";
export type CircleSource = "landing_page" | "email_reply" | "manual";

export interface CircleMember {
  id: string;
  created_at: string;
  updated_at: string;
  name: string | null;
  email: string;
  tier: CircleTier;
  founding_member: boolean;
  trial_ends_at: string | null;
  status: CircleStatus;
  source: CircleSource | null;
  joined_at: string;
  notes: string | null;
  client_id: string | null;
}

const TABLE = "circle_members" as any;

export function useCircleMembers() {
  return useQuery({
    queryKey: ["circle-members"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CircleMember[];
    },
    staleTime: 1000 * 60,
  });
}

export function useUpdateCircleMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CircleMember> }) => {
      const { error } = await (supabase as any).from(TABLE).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circle-members"] }),
  });
}

export function useCreateCircleMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CircleMember>) => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data as CircleMember;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circle-members"] }),
  });
}

export function useCircleStats() {
  const { data: members = [], isLoading } = useCircleMembers();

  const now = Date.now();
  const thirtyDaysAgo = now - 1000 * 60 * 60 * 24 * 30;
  const sevenDaysFromNow = now + 1000 * 60 * 60 * 24 * 7;

  const stats = {
    total: members.length,
    founding: members.filter((m) => m.founding_member).length,
    foundingCap: 20,
    activeThisMonth: members.filter(
      (m) => new Date(m.joined_at).getTime() >= thirtyDaysAgo
    ).length,
    trialEndingSoon: members.filter((m) => {
      if (!m.trial_ends_at) return false;
      const t = new Date(m.trial_ends_at).getTime();
      return t > now && t <= sevenDaysFromNow;
    }).length,
  };

  return { stats, isLoading };
}