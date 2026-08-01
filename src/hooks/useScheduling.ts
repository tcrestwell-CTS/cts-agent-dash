import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AvailabilityWindow {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  buffer_minutes: number;
}

export interface AvailabilityBlock {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface AgentMeeting {
  id: string;
  user_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  topic: string | null;
  notes: string | null;
  agent_notes: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
}

export interface BookingSettings {
  booking_slug: string | null;
  booking_enabled: boolean;
  booking_timezone: string;
  booking_instructions: string | null;
  booking_contact_phone: string | null;
  full_name: string | null;
}

/** Agent's own booking settings from their profile. */
export function useBookingSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["booking-settings", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<BookingSettings | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "full_name, booking_slug, booking_enabled, booking_timezone, booking_instructions, booking_contact_phone",
        )
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as BookingSettings) ?? null;
    },
  });
}

export function useUpdateBookingSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<BookingSettings>) => {
      const { error } = await supabase
        .from("profiles")
        .update(patch as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking-settings"] }),
  });
}

export function useAvailability(userId?: string) {
  return useQuery({
    queryKey: ["agent-availability", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AvailabilityWindow[]> => {
      const { data, error } = await supabase
        .from("agent_availability")
        .select("*")
        .eq("user_id", userId!)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as AvailabilityWindow[];
    },
  });
}

export function useSaveAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<AvailabilityWindow> & { user_id: string }) => {
      if (row.id) {
        const { error } = await supabase
          .from("agent_availability")
          .update(row as any)
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agent_availability").insert(row as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-availability"] }),
  });
}

export function useDeleteAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_availability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-availability"] }),
  });
}

export function useAvailabilityBlocks(userId?: string) {
  return useQuery({
    queryKey: ["agent-availability-blocks", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AvailabilityBlock[]> => {
      const { data, error } = await supabase
        .from("agent_availability_blocks")
        .select("*")
        .eq("user_id", userId!)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as AvailabilityBlock[];
    },
  });
}

export function useAgentMeetings(userId?: string) {
  return useQuery({
    queryKey: ["agent-meetings", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AgentMeeting[]> => {
      const { data, error } = await supabase
        .from("agent_meetings")
        .select("*")
        .eq("user_id", userId!)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AgentMeeting[];
    },
  });
}

export function useUpdateMeetingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AgentMeeting["status"] }) => {
      const { error } = await supabase
        .from("agent_meetings")
        .update({
          status,
          cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-meetings"] }),
  });
}