import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AgentSubscription {
  id: string;
  agent_user_id: string;
  plan_name: string;
  plan_description: string | null;
  amount: number;
  billing_interval: string;
  status: string;
  started_on: string | null;
  next_billing_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_exp: string | null;
  notes: string | null;
}

/** The signed-in advisor's own subscription record (null when none is set up). */
export function useMyAgentSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-agent-subscription", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agent_subscriptions")
        .select("*")
        .eq("agent_user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AgentSubscription | null;
    },
    enabled: !!user,
  });
}

/** All advisor subscriptions (admin / office admin / bookkeeper visibility). */
export function useAgentSubscriptions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["agent-subscriptions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agent_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgentSubscription[];
    },
    enabled: !!user,
  });
}

export function useUpsertAgentSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: Partial<AgentSubscription> & { agent_user_id: string }) => {
      const { data, error } = await (supabase as any)
        .from("agent_subscriptions")
        .upsert(values, { onConflict: "agent_user_id" })
        .select("*")
        .single();
      if (error) throw error;
      return data as AgentSubscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["my-agent-subscription"] });
      toast.success("Subscription saved");
    },
    onError: (e: any) => toast.error(e.message || "Could not save subscription"),
  });
}

/** Opens Stripe so the advisor can update the card on file. */
export function useUpdateBillingPaymentMethod() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("agent-billing", {
        body: { action: "update_payment_method", return_url: `${window.location.origin}/settings` },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { url: string; mode: string };
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (e: any) => toast.error(e.message || "Could not open billing"),
  });
}

/** Refreshes the stored card summary / plan details from Stripe. */
export function useSyncBillingPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("agent-billing", {
        body: { action: "sync_payment_method" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).subscription as AgentSubscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-agent-subscription"] });
      toast.success("Billing details refreshed");
    },
    onError: (e: any) => toast.error(e.message || "Could not refresh billing details"),
  });
}
