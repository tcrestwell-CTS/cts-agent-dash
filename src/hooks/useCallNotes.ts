import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CallNote {
  id: string;
  client_id: string;
  trip_id: string | null;
  user_id: string;
  call_date: string;
  call_type: string;
  title: string;
  summary: string | null;
  key_points: string[];
  action_items: string[];
  follow_up_date: string | null;
  sentiment: string | null;
  transcript: string | null;
  created_at: string;
}

export function useCallNotes(clientId?: string) {
  return useQuery({
    queryKey: ["call-notes", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_call_notes" as any)
        .select("*")
        .eq("client_id", clientId!)
        .order("call_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CallNote[];
    },
    enabled: !!clientId,
  });
}

export interface SummarizeCallInput {
  client_id: string;
  transcript: string;
  call_date: string;
  call_type: string;
  trip_id?: string | null;
}

/** Sends a transcript to Nadia (nadia-notes edge function) and stores the result. */
export function useSummarizeCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SummarizeCallInput) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in again to use Nadia");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nadia-notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Nadia could not summarize that call");
      return data.note as CallNote;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["call-notes", note.client_id] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useDeleteCallNote(clientId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_call_notes" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-notes", clientId] });
    },
  });
}