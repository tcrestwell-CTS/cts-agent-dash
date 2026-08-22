import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BookingPayerShare {
  id: string;
  booking_id: string;
  trip_id: string | null;
  user_id: string;
  traveler_id: string | null;
  payer_name: string;
  payer_email: string | null;
  share_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayerShareInput {
  id?: string;
  traveler_id?: string | null;
  payer_name: string;
  payer_email?: string | null;
  share_amount: number;
  notes?: string | null;
}

/** Shares for a single booking. */
export function useBookingPayerShares(bookingId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["booking-payer-shares", bookingId],
    queryFn: async () => {
      if (!bookingId) return [] as BookingPayerShare[];
      const { data, error } = await supabase
        .from("booking_payer_shares")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as BookingPayerShare[];
    },
    enabled: !!user && !!bookingId,
  });
}

/** All shares across a trip, so payment rows can be tagged with a payer. */
export function useTripPayerShares(tripId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trip-payer-shares", tripId],
    queryFn: async () => {
      if (!tripId) return [] as BookingPayerShare[];
      const { data, error } = await supabase
        .from("booking_payer_shares")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as BookingPayerShare[];
    },
    enabled: !!user && !!tripId,
  });
}

export function useSaveBookingPayerShares() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      bookingId,
      tripId,
      shares,
      removedIds = [],
    }: {
      bookingId: string;
      tripId?: string | null;
      shares: PayerShareInput[];
      removedIds?: string[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      if (removedIds.length > 0) {
        const { error } = await supabase
          .from("booking_payer_shares")
          .delete()
          .in("id", removedIds);
        if (error) throw error;
      }

      const rows = shares
        .filter((s) => s.payer_name.trim().length > 0)
        .map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          booking_id: bookingId,
          trip_id: tripId || null,
          user_id: user.id,
          traveler_id: s.traveler_id || null,
          payer_name: s.payer_name.trim(),
          payer_email: s.payer_email?.trim() || null,
          share_amount: Math.round((Number(s.share_amount) || 0) * 100) / 100,
          notes: s.notes || null,
        }));

      if (rows.length === 0) return [];

      const { data, error } = await supabase
        .from("booking_payer_shares")
        .upsert(rows, { onConflict: "id" })
        .select();
      if (error) throw error;
      return data as BookingPayerShare[];
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["booking-payer-shares", variables.bookingId] });
      if (variables.tripId) {
        queryClient.invalidateQueries({ queryKey: ["trip-payer-shares", variables.tripId] });
      }
    },
    onError: (error: any) => {
      toast.error("Failed to save payer shares: " + (error?.message || "unknown error"));
    },
  });
}

export function useDeleteBookingPayerShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; bookingId?: string; tripId?: string | null }) => {
      const { error } = await supabase.from("booking_payer_shares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ["booking-payer-shares", variables.bookingId] });
      if (variables.tripId) {
        queryClient.invalidateQueries({ queryKey: ["trip-payer-shares", variables.tripId] });
      }
    },
  });
}
