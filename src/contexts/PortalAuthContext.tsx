import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PortalSession {
  clientId: string;
  clientName: string;
  token: string;
}

interface PortalAuthContextType {
  session: PortalSession | null;
  loading: boolean;
  login: (token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("portal_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Re-verify token on load
        verifyToken(parsed.token).then((valid) => {
          if (valid) {
            setSession(parsed);
          } else {
            localStorage.removeItem("portal_session");
          }
          setLoading(false);
        });
      } catch {
        localStorage.removeItem("portal_session");
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("portal-auth", {
        body: { action: "verify-token", token },
      });
      return !error && data?.success;
    } catch {
      return false;
    }
  };

  const login = useCallback(async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("portal-auth", {
        body: { action: "verify-token", token },
      });

      if (error || !data?.success) {
        return { success: false, error: data?.error || "Invalid or expired link" };
      }

      const portalSession: PortalSession = {
        clientId: data.client_id,
        clientName: data.client_name,
        token: data.token,
      };

      localStorage.setItem("portal_session", JSON.stringify(portalSession));
      setSession(portalSession);
      return { success: true };
    } catch {
      return { success: false, error: "Connection error" };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("portal_session");
    setSession(null);
  }, []);

  return (
    <PortalAuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return ctx;
}
