import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface PortalSessionLike {
  authUser?: User;
}

export function getLegacyPortalToken(): string | null {
  try {
    const stored = localStorage.getItem("portal_session");
    return stored ? JSON.parse(stored).token : null;
  } catch {
    return null;
  }
}

export async function getPortalAuthHeaders(
  session: PortalSessionLike | null,
  options: { includeContentType?: boolean } = {},
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  if (session?.authUser) {
    const { data: { session: supaSession } } = await supabase.auth.getSession();
    if (supaSession?.access_token) {
      headers.Authorization = `Bearer ${supaSession.access_token}`;
    }
  }

  if (!headers.Authorization) {
    const portalToken = getLegacyPortalToken();
    if (portalToken) {
      headers["x-portal-token"] = portalToken;
    }
  }

  if (options.includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}
