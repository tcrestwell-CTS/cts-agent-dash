import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CommissionTier, getTierConfig } from "@/lib/commissionTiers";

export interface Commission {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number;
  rate: number;
  status: string;
  paid_date: string | null;
  expected_commission: number;
  created_at: string;
  updated_at: string;
  holdback_amount: number;
  holdback_released: boolean;
  holdback_released_at: string | null;
}

export interface CommissionInsert {
  booking_id: string;
  amount: number;
  rate: number;
  status?: string;
  paid_date?: string | null;
}

export function useCommissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["commissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Commission[];
    },
    enabled: !!user,
  });
}

export function useBookingCommission(bookingId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["commission", bookingId],
    queryFn: async () => {
      if (!bookingId) return null;

      const { data, error } = await supabase
        .from("commissions")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle();

      if (error) throw error;
      return data as Commission | null;
    },
    enabled: !!user && !!bookingId,
  });
}

export function useCreateCommission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (commission: CommissionInsert) => {
      if (!user) throw new Error("User not authenticated");

      // Fetch agency settings for holdback percentage
      const { data: agencySettings } = await supabase
        .from("agency_settings")
        .select("commission_holdback_pct")
        .limit(1)
        .maybeSingle();

      const holdbackPct = agencySettings?.commission_holdback_pct ?? 10;
      const holdbackAmount = (commission.amount * holdbackPct) / 100;

      const { data, error } = await supabase
        .from("commissions")
        .insert({
          ...commission,
          user_id: user.id,
          status: commission.status || "pending",
          holdback_amount: holdbackAmount,
          holdback_released: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["commission", data.booking_id] });
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      toast.success("Commission created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create commission: " + error.message);
    },
  });
}

export function useUpdateCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Commission> & { id: string }) => {
      const { data, error } = await supabase
        .from("commissions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["commission", data.booking_id] });
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      toast.success("Commission updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update commission: " + error.message);
    },
  });
}

export function useUserCommissionRate() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-commission-rate", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("commission_rate, commission_tier")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      // Use tier-based rate if available, otherwise fall back to commission_rate
      const tier = data?.commission_tier as CommissionTier | null;
      if (tier) {
        return getTierConfig(tier).agentSplit;
      }
      return data?.commission_rate ?? 10; // Default to 10% if not set
    },
    enabled: !!user,
  });
}

export function useUserCommissionTier() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-commission-tier", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("commission_tier")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return (data?.commission_tier as CommissionTier | null) || "tier_1";
    },
    enabled: !!user,
  });
}
