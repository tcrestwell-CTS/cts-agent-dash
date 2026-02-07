import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type Client = Tables<"clients">;
export type ClientInsert = TablesInsert<"clients">;

export function useClients() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
  });
}

export function useClientWithBookings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["clients-with-bookings", user?.id],
    queryFn: async () => {
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      // Fetch booking stats for each client
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("client_id, total_amount");

      if (bookingsError) throw bookingsError;

      // Calculate totals per client
      const bookingStats = bookings?.reduce((acc, booking) => {
        if (!acc[booking.client_id]) {
          acc[booking.client_id] = { count: 0, total: 0 };
        }
        acc[booking.client_id].count += 1;
        acc[booking.client_id].total += Number(booking.total_amount) || 0;
        return acc;
      }, {} as Record<string, { count: number; total: number }>);

      return (clients || []).map((client) => ({
        ...client,
        totalBookings: bookingStats?.[client.id]?.count || 0,
        totalSpent: bookingStats?.[client.id]?.total || 0,
      }));
    },
    enabled: !!user,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (client: Omit<ClientInsert, "user_id">) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("clients")
        .insert({ ...client, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-with-bookings"] });
      toast.success("Client created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create client: " + error.message);
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      const { data, error } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-with-bookings"] });
      toast.success("Client updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update client: " + error.message);
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-with-bookings"] });
      toast.success("Client deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete client: " + error.message);
    },
  });
}
