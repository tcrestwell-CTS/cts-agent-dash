import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PeriodLockRow {
  id: string;
  period_year: number;
  period_month: number;
  locked_by: string | null;
  locked_at: string;
  notes: string | null;
}

export function usePeriodLock(year: number, month: number) {
  const qc = useQueryClient();
  const queryKey = ["period-lock", year, month];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<PeriodLockRow | null> => {
      const { data, error } = await (supabase as any)
        .from("period_locks")
        .select("*")
        .eq("period_year", year)
        .eq("period_month", month)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const lockPeriod = useMutation({
    mutationFn: async (notes?: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("period_locks").insert({
        period_year: year,
        period_month: month,
        locked_by: auth.user?.id,
        notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["period-locks-all"] });
    },
  });

  const unlockPeriod = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("period_locks")
        .delete()
        .eq("period_year", year)
        .eq("period_month", month);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["period-locks-all"] });
    },
  });

  return {
    isLocked: !!data,
    lockedAt: data?.locked_at ?? null,
    lockedBy: data?.locked_by ?? null,
    notes: data?.notes ?? null,
    isLoading,
    lockPeriod,
    unlockPeriod,
  };
}

/** Returns all locked (year, month) pairs — useful for month-picker indicators. */
export function useAllPeriodLocks() {
  return useQuery({
    queryKey: ["period-locks-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("period_locks")
        .select("period_year, period_month, locked_at");
      if (error) throw error;
      return (data ?? []) as Pick<PeriodLockRow, "period_year" | "period_month" | "locked_at">[];
    },
  });
}