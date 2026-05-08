import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AudienceFilter {
  type: "all_clients" | "all_leads" | "all_contacts" | "manual";
  emails?: string[];
}

export interface CampaignAudience {
  id: string;
  name: string;
  description: string | null;
  filter: AudienceFilter;
  contact_count: number | null;
  last_counted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useCampaignAudiences() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["campaign-audiences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_audiences" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CampaignAudience[];
    },
  });

  const save = useMutation({
    mutationFn: async (
      input: Partial<CampaignAudience> & { name: string; filter: AudienceFilter },
    ) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (input.id) {
        const { error } = await supabase
          .from("campaign_audiences" as any)
          .update({
            name: input.name,
            description: input.description ?? null,
            filter: input.filter as any,
          } as any)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campaign_audiences" as any).insert({
          name: input.name,
          description: input.description ?? null,
          filter: input.filter as any,
          created_by: user?.id ?? null,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-audiences"] });
      toast.success("Audience saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campaign_audiences" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-audiences"] });
      toast.success("Audience deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, save, remove };
}