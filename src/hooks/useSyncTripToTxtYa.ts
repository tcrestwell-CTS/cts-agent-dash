import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SyncArgs {
  trip_id: string;
  traveler_kind: "primary" | "companion";
  companion_id?: string;
}

export function useSyncTripToTxtYa() {
  return useMutation({
    mutationFn: async (args: SyncArgs) => {
      const { data, error } = await supabase.functions.invoke("txtya-sync", {
        body: args,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.skipped) {
        toast.info("TxtYa sync skipped — integration is disabled for this agency.");
      } else if (data?.ok) {
        toast.success("Synced to TxtYa.");
      } else {
        toast.error("TxtYa sync failed: " + (data?.response?.error || "unknown error"));
      }
    },
    onError: (e: Error) => toast.error("TxtYa sync failed: " + e.message),
  });
}