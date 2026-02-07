import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Commission {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number;
  rate: number;
  status: string;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionInsert {
  booking_id: string;
  amount: number;
  rate: number;
  status?: string;
  paid_date?: string | null;
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

      const { data, error } = await supabase
        .from("commissions")
        .insert({
          ...commission,
          user_id: user.id,
          status: commission.status || "pending",
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
        .select("commission_rate")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data?.commission_rate ?? 10; // Default to 10% if not set
    },
    enabled: !!user,
  });
}
