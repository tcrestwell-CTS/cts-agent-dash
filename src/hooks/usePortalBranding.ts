import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortalBranding {
  agency_name: string;
  primary_color: string;
  accent_color: string;
  logo_url: string;
  tagline: string;
}

const DEFAULT_BRANDING: PortalBranding = {
  agency_name: "Crestwell Travel Services",
  primary_color: "#0D7377",
  accent_color: "#E8A87C",
  logo_url: "",
  tagline: "Your Journey, Our Passion",
};

export function usePortalBranding() {
  return useQuery({
    queryKey: ["portal", "branding"],
    queryFn: async (): Promise<PortalBranding> => {
      // Try to get branding from the client's agent
      const stored = localStorage.getItem("portal_session");
      if (!stored) return DEFAULT_BRANDING;

      try {
        const { clientId } = JSON.parse(stored);
        // We can get branding from the dashboard data which includes agent info
        // For now, return defaults - branding will come from dashboard API
        return DEFAULT_BRANDING;
      } catch {
        return DEFAULT_BRANDING;
      }
    },
    staleTime: 5 * 60_000,
  });
}
