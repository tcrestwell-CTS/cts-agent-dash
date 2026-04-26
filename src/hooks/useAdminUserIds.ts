import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns the set of user_ids that have the 'admin' role.
 *
 * Used by reporting surfaces (dashboard agency income, etc.) so that
 * bookings owned by an agency owner/admin can be treated as 100%
 * company income rather than split via the standard agent commission tier.
 */
export function useAdminUserIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["admin-user-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (error) {
        console.error("Error fetching admin user_ids:", error);
        return new Set<string>();
      }
      return new Set<string>((data ?? []).map((r) => r.user_id));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}