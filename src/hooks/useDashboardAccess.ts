import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Returns a map of userId → whether the `dashboard` feature is allowed.
 * Defaults to `true` (registry default) when no override exists.
 */
export function useDashboardAccess() {
  return useQuery({
    queryKey: ["dashboard-access-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_feature_permissions")
        .select("user_id, allowed")
        .eq("feature_key", "dashboard");
      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const row of data ?? []) map[row.user_id] = row.allowed;
      return map;
    },
  });
}

export function useToggleDashboardAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, allowed }: { userId: string; allowed: boolean }) => {
      const { error } = await supabase
        .from("user_feature_permissions")
        .upsert(
          { user_id: userId, feature_key: "dashboard", allowed },
          { onConflict: "user_id,feature_key" }
        );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-access-map"] });
      queryClient.invalidateQueries({ queryKey: ["feature-permissions", vars.userId] });
      queryClient.invalidateQueries({ queryKey: ["user-feature-permissions", vars.userId] });
      toast.success(vars.allowed ? "Dashboard enabled" : "Dashboard disabled");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to update dashboard access");
    },
  });
}

/** Returns a map of userId → whether Email & Branding is enabled. */
export function useEmailBrandingAccess() {
  return useQuery({
    queryKey: ["email-branding-access-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_feature_permissions")
        .select("user_id, allowed")
        .eq("feature_key", "email_branding");
      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const row of data ?? []) map[row.user_id] = row.allowed;
      return map;
    },
  });
}

export function useToggleEmailBrandingAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, allowed }: { userId: string; allowed: boolean }) => {
      const { error } = await supabase
        .from("user_feature_permissions")
        .upsert(
          { user_id: userId, feature_key: "email_branding", allowed },
          { onConflict: "user_id,feature_key" }
        );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["email-branding-access-map"] });
      queryClient.invalidateQueries({ queryKey: ["feature-permissions", vars.userId] });
      queryClient.invalidateQueries({ queryKey: ["user-feature-permissions", vars.userId] });
      toast.success(vars.allowed ? "Email & Branding enabled" : "Email & Branding disabled");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to update Email & Branding access");
    },
  });
}