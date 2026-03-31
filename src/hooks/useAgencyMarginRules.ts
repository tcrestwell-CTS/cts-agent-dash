import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { AgencyMarginRule, AgencyMarginRuleInsert, BookingMarginAudit } from "@/types/margin";

export function useAgencyMarginRules() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const QK = ["agency-margin-rules"];

  const { data: rules = [], isLoading } = useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agency_margin_rules")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data as AgencyMarginRule[];
    },
    enabled: !!user,
  });

  const createRule = useMutation({
    mutationFn: async (input: AgencyMarginRuleInsert) => {
      const { error } = await (supabase as any)
        .from("agency_margin_rules")
        .insert({ ...input, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast.success("Rule created");
    },
    onError: () => toast.error("Failed to create rule"),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AgencyMarginRule> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("agency_margin_rules")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast.success("Rule updated");
    },
    onError: () => toast.error("Failed to update rule"),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("agency_margin_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast.success("Rule deleted");
    },
    onError: () => toast.error("Failed to delete rule"),
  });

  return {
    rules,
    activeRules: rules.filter(r => r.is_active),
    isLoading,
    createRule,
    updateRule,
    deleteRule,
  };
}

// ── Booking Margin Audit ───────────────────────────────────────────────────

export function useBookingMarginAudit(bookingId: string | undefined) {
  const { user } = useAuth();

  const { data: audit = [], isLoading } = useQuery({
    queryKey: ["booking-margin-audit", bookingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_margin_audit")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BookingMarginAudit[];
    },
    enabled: !!bookingId && !!user,
  });

  return { audit, isLoading };
}
