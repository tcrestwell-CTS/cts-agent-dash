import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, useIsOfficeAdmin } from "@/hooks/useAdmin";
import { FEATURE_REGISTRY, type FeatureKey } from "@/lib/featureRegistry";

/**
 * Returns a stable map of feature_key → allowed for the current user.
 * Admins and office admins always get every feature.
 * For plain agents, defaults from FEATURE_REGISTRY are used unless an
 * explicit row in user_feature_permissions overrides it.
 */
export function useFeaturePermissions() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: isOfficeAdmin, isLoading: officeLoading } = useIsOfficeAdmin();

  const bypass = !!isAdmin || !!isOfficeAdmin;

  const query = useQuery({
    queryKey: ["feature-permissions", user?.id],
    queryFn: async () => {
      if (!user) return {} as Record<string, boolean>;
      const { data, error } = await supabase
        .from("user_feature_permissions")
        .select("feature_key, allowed")
        .eq("user_id", user.id);
      if (error) {
        console.error("Error loading feature permissions:", error);
        return {} as Record<string, boolean>;
      }
      const overrides: Record<string, boolean> = {};
      for (const row of data ?? []) overrides[row.feature_key] = row.allowed;
      return overrides;
    },
    enabled: !!user && !bypass,
    staleTime: 1000 * 60 * 5,
  });

  const overrides = query.data ?? {};

  const can = (key: FeatureKey): boolean => {
    if (bypass) return true;
    if (key in overrides) return overrides[key];
    const meta = FEATURE_REGISTRY.find((f) => f.key === key);
    return meta?.defaultAllowed ?? false;
  };

  return {
    can,
    isLoading: adminLoading || officeLoading || (!bypass && query.isLoading),
    isAdminBypass: bypass,
  };
}

/**
 * Admin-only: load a specific user's feature overrides for the management UI.
 */
export function useUserFeaturePermissions(userId: string | null) {
  return useQuery({
    queryKey: ["user-feature-permissions", userId],
    queryFn: async () => {
      if (!userId) return {} as Record<string, boolean>;
      const { data, error } = await supabase
        .from("user_feature_permissions")
        .select("feature_key, allowed")
        .eq("user_id", userId);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const row of data ?? []) map[row.feature_key] = row.allowed;
      return map;
    },
    enabled: !!userId,
  });
}