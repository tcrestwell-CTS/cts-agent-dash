import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ALL_SECTIONS = ["dashboard", "trips", "payments", "messages", "invoices"];

export function usePortalManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all clients with their portal sessions and settings
  const { data: portalUsers = [], isLoading } = useQuery({
    queryKey: ["portal-management", user?.id],
    queryFn: async () => {
      // Get all clients for this agent
      const { data: clients, error: clientErr } = await supabase
        .from("clients")
        .select("id, name, email, phone, status, created_at")
        .order("name");
      if (clientErr) throw clientErr;

      // Get portal sessions (table is locked down; read via backend function)
      const { data: sessionRes } = await supabase.functions.invoke("portal-auth", {
        body: { action: "staff-session-status", client_ids: (clients || []).map((c) => c.id) },
      });
      const sessions: { id: string; client_id: string; created_at: string; expires_at: string; verified_at: string | null }[] =
        sessionRes?.sessions || [];

      // Get portal settings
      const { data: settings } = await supabase
        .from("portal_client_settings")
        .select("*");

      return (clients || []).map((client) => {
        const clientSessions = (sessions || []).filter(
          (s) => s.client_id === client.id
        );
        const lastSession = clientSessions.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        const setting = (settings || []).find(
          (s) => s.client_id === client.id
        );

        return {
          ...client,
          hasPortalAccess: clientSessions.some((s) => s.verified_at !== null),
          lastLogin: lastSession?.verified_at || lastSession?.created_at || null,
          sessionCount: clientSessions.length,
          portalEnabled: setting?.portal_enabled ?? true,
          visibleSections: setting?.visible_sections ?? ALL_SECTIONS,
          settingsId: setting?.id ?? null,
        };
      });
    },
    enabled: !!user?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async ({
      clientId,
      portalEnabled,
      visibleSections,
    }: {
      clientId: string;
      portalEnabled: boolean;
      visibleSections: string[];
    }) => {
      const { data: existing } = await supabase
        .from("portal_client_settings")
        .select("id")
        .eq("client_id", clientId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("portal_client_settings")
          .update({ portal_enabled: portalEnabled, visible_sections: visibleSections })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("portal_client_settings")
          .insert({
            client_id: clientId,
            user_id: user!.id,
            portal_enabled: portalEnabled,
            visible_sections: visibleSections,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-management"] });
      toast.success("Portal settings updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetSession = useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke("portal-auth", {
        body: { action: "staff-reset-sessions", client_ids: [clientId] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-management"] });
      toast.success("Client sessions reset");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    portalUsers,
    isLoading,
    updateSettings,
    resetSession,
    ALL_SECTIONS,
  };
}
