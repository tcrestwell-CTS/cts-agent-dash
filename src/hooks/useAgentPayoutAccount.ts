import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type PayoutMethod = "ach" | "check" | "wire" | "zelle" | "paypal" | "venmo" | "other";

export interface AgentPayoutAccount {
  id?: string;
  user_id?: string;
  payout_method: PayoutMethod;
  payee_name: string | null;
  business_name: string | null;
  tax_id_last4: string | null;
  tax_form: "W9" | "W8BEN" | "none" | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  bank_name: string | null;
  account_holder_name: string | null;
  account_type: "checking" | "savings" | null;
  routing_number: string | null;
  account_number: string | null;
  account_number_last4: string | null;
  zelle_handle: string | null;
  paypal_email: string | null;
  venmo_handle: string | null;
  notes: string | null;
}

export function useAgentPayoutAccount(targetUserId?: string) {
  const { user } = useAuth();
  const userId = targetUserId ?? user?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["agent-payout-account", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agent_payout_accounts")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as AgentPayoutAccount | null;
    },
  });

  const save = useMutation({
    mutationFn: async (input: Partial<AgentPayoutAccount>) => {
      if (!userId) throw new Error("Not authenticated");
      const payload: any = { ...input, user_id: userId };
      // Don't send the synthesized last4 from client
      delete payload.account_number_last4;
      const { data, error } = await (supabase as any)
        .from("agent_payout_accounts")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data as AgentPayoutAccount;
    },
    onSuccess: () => {
      toast.success("Payout details saved");
      qc.invalidateQueries({ queryKey: ["agent-payout-account", userId] });
      qc.invalidateQueries({ queryKey: ["agent-payouts-all"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save payout details"),
  });

  return { ...query, save };
}