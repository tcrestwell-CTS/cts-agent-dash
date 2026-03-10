import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Quote {
  id: string;
  user_id: string;
  client_id: string | null;
  trip_id: string | null;
  quote_number: string;
  title: string;
  description: string | null;
  total_amount: number;
  status: string;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useQuotes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["quotes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Quote[];
    },
    enabled: !!user,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (quote: Omit<Quote, "id" | "user_id" | "created_at" | "updated_at">) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("quotes" as any)
        .insert({ ...quote, user_id: user.id } as any)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Quote created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create quote: " + error.message);
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Quote> & { id: string }) => {
      const { data, error } = await supabase
        .from("quotes" as any)
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Quote updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update quote: " + error.message);
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Quote deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete quote: " + error.message);
    },
  });
}
