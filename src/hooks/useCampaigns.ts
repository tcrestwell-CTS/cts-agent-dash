import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  body_html: string;
  body_text: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "paused" | "failed";
  audience_id: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_complained: number;
  total_unsubscribed: number;
  total_suppressed: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Campaign[];
    },
  });
}

export function useCampaign(id?: string) {
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("campaigns" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Campaign | null;
    },
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Campaign>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("campaigns" as any)
        .insert({
          name: input.name ?? "Untitled campaign",
          subject: input.subject ?? "",
          body_html: input.body_html ?? "",
          from_name: input.from_name ?? "Crestwell Travel",
          from_email: input.from_email ?? "news@crestwellgetaways.com",
          reply_to: input.reply_to ?? "tim@crestwellgetaways.com",
          preheader: input.preheader ?? null,
          audience_id: input.audience_id ?? null,
          created_by: user?.id ?? null,
          status: "draft",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Campaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Campaign> & { id: string }) => {
      const { error } = await supabase
        .from("campaigns" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign", vars.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke("send-campaign", {
        body: { campaignId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign sent!");
    },
    onError: (e: Error) => toast.error(`Send failed: ${e.message}`),
  });
}

export function useMaterializeAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { campaignId: string; audienceId: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "materialize-audience",
        { body: input },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { ok: boolean; count: number };
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign", vars.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-recipients", vars.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-audiences"] });
      toast.success(`Audience materialized: ${data.count} recipients`);
    },
    onError: (e: Error) => toast.error(`Audience build failed: ${e.message}`),
  });
}

export function useCampaignRecipientCount(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign-recipients", campaignId],
    queryFn: async () => {
      if (!campaignId) return 0;
      const { count, error } = await supabase
        .from("campaign_recipients" as any)
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "queued");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!campaignId,
  });
}

export function useGenerateCampaignCopy() {
  return useMutation({
    mutationFn: async (input: {
      mode: "subjects" | "body" | "improve";
      topic?: string;
      tone?: string;
      cta?: string;
      audience?: string;
      selection?: string;
      instruction?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "generate-campaign-copy",
        { body: input },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { subjects?: string[]; html?: string; content?: string };
    },
    onError: (e: Error) => toast.error(`AI: ${e.message}`),
  });
}