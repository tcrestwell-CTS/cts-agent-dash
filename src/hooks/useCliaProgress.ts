import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CliaActivityKind = "stateroom_booking" | "ship_inspection" | "personal_cruise" | "course_credit";

export interface CliaActivity {
  id: string;
  kind: CliaActivityKind;
  occurred_on: string;
  title: string;
  cruise_line: string | null;
  nights: number | null;
  credits: number | null;
  notes: string | null;
}

/**
 * ACC-level targets. CLIA states that requirements vary by year, so these are
 * reviewed annually by the education team and must be confirmed against CLIA
 * before an advisor submits an application.
 */
export const CLIA_ACC_TARGETS = {
  stateroom_booking: 20,
  ship_inspection: 5,
  personal_cruise: 2,
  course_credit: 40,
};

export const CLIA_KIND_LABELS: Record<CliaActivityKind, string> = {
  stateroom_booking: "Stateroom bookings",
  ship_inspection: "Ship inspections",
  personal_cruise: "Personal cruises (2+ nights)",
  course_credit: "CLIA coursework credits",
};

export function useCliaActivity() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academy-clia-activity", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_clia_activity")
        .select("*")
        .eq("user_id", user!.id)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data || []) as CliaActivity[];
    },
    enabled: !!user,
  });
}

export function useCliaTotals() {
  const { data } = useCliaActivity();
  const rows = data || [];
  const count = (kind: CliaActivityKind) => rows.filter((r) => r.kind === kind).length;
  return {
    stateroom_booking: count("stateroom_booking"),
    ship_inspection: count("ship_inspection"),
    personal_cruise: count("personal_cruise"),
    course_credit: rows
      .filter((r) => r.kind === "course_credit")
      .reduce((sum, r) => sum + Number(r.credits || 0), 0),
  };
}

export function useLogCliaActivity() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      kind: CliaActivityKind;
      title: string;
      occurred_on: string;
      cruise_line?: string | null;
      nights?: number | null;
      credits?: number | null;
      notes?: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("academy_clia_activity").insert([
        {
          user_id: user.id,
          kind: input.kind,
          title: input.title,
          occurred_on: input.occurred_on,
          cruise_line: input.cruise_line ?? null,
          nights: input.nights ?? null,
          credits: input.credits ?? 0,
          notes: input.notes ?? null,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academy-clia-activity"] }),
  });
}

export function useDeleteCliaActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academy_clia_activity").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academy-clia-activity"] }),
  });
}
