import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "./useAdmin";
import { toast } from "sonner";

export interface PendingOverride {
  id: string;
  booking_reference: string;
  destination: string;
  owner_agent: string | null;
  user_id: string;
  gross_sales: number;
  calculated_commission: number;
  commission_override_amount: number;
  override_notes: string | null;
  created_at: string;
  client: {
    name: string;
  } | null;
  agent: {
    full_name: string | null;
  } | null;
}

export function usePendingOverrides() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ["pending-overrides", user?.id],
    queryFn: async () => {
      // Fetch bookings with pending approval
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(`
          id,
          booking_reference,
          destination,
          owner_agent,
          user_id,
          gross_sales,
          calculated_commission,
          commission_override_amount,
          override_notes,
          created_at,
          clients (name)
        `)
        .eq("override_pending_approval", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch agent profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      // Map results
      const result: PendingOverride[] = (bookings || []).map((booking) => {
        const agent = profiles?.find((p) => p.user_id === booking.user_id);
        return {
          ...booking,
          client: booking.clients as { name: string } | null,
          agent: agent ? { full_name: agent.full_name } : null,
        };
      });

      return result;
    },
    enabled: !!user && !!isAdmin,
  });
}

export function useApproveOverride() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Get the booking to update commission_revenue
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select("commission_override_amount, gross_sales")
        .eq("id", bookingId)
        .single();

      if (fetchError) throw fetchError;

      // Update booking with approval and set commission_revenue to override amount
      const { error } = await supabase
        .from("bookings")
        .update({
          override_pending_approval: false,
          override_approved: true,
          override_approved_by: user.id,
          override_approved_at: new Date().toISOString(),
          commission_revenue: booking.commission_override_amount,
          net_sales: booking.gross_sales - booking.commission_override_amount,
        })
        .eq("id", bookingId);

      if (error) throw error;
      return bookingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Commission override approved");
    },
    onError: (error) => {
      console.error("Error approving override:", error);
      toast.error("Failed to approve override");
    },
  });
}

export function useRejectOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      // Reject by clearing override and using calculated commission
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select("calculated_commission")
        .eq("id", bookingId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from("bookings")
        .update({
          override_pending_approval: false,
          override_approved: false,
          commission_override_amount: null,
          commission_revenue: booking.calculated_commission,
          override_notes: null,
        })
        .eq("id", bookingId);

      if (error) throw error;
      return bookingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Commission override rejected - using calculated amount");
    },
    onError: (error) => {
      console.error("Error rejecting override:", error);
      toast.error("Failed to reject override");
    },
  });
}
