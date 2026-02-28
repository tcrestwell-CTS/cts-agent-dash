import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface PortalSession {
  clientId: string;
  clientName: string;
  token: string;
  expiresAt: number; // Unix timestamp (ms)
}

interface PortalAuthContextType {
  session: PortalSession | null;
  loading: boolean;
  login: (token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);

// Moved outside component — no closure dependencies
// NOTE: Portal tokens are stored in localStorage for convenience.
// This is an accepted tradeoff for a magic-link portal with single-use,
// time-limited tokens. httpOnly cookies would be more secure against XSS
// but require additional backend support.
async function verifyToken(token: string): Promise<{ success: boolean; data?: any }> {
  try {
    const { data, error } = await supabase.functions.invoke("portal-auth", {
      body: { action: "verify-token", token },
    });
    return { success: !error && data?.success, data };
  } catch {
    return { success: false };
  }
}

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("portal_session");
    if (stored) {
      try {
        const parsed: PortalSession = JSON.parse(stored);

        // Cheap local expiry check before hitting the network
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          localStorage.removeItem("portal_session");
          setLoading(false);
          return;
        }

        // Re-verify token on load
        verifyToken(parsed.token).then(({ success }) => {
          if (success) {
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

  // Consolidated: uses shared verifyToken, stores server-rotated token
  const login = useCallback(async (token: string) => {
    const result = await verifyToken(token);

    if (!result.success || !result.data) {
      return { success: false, error: result.data?.error || "Invalid or expired link" };
    }

    const { client_id, client_name, token: serverToken, expires_at } = result.data;

    const portalSession: PortalSession = {
      clientId: client_id,
      clientName: client_name,
      // Server may rotate token on verify — use returned value
      token: serverToken,
      expiresAt: expires_at ? new Date(expires_at).getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    localStorage.setItem("portal_session", JSON.stringify(portalSession));
    setSession(portalSession);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("portal_session");
    setSession(null);
    // Redirect handled by PortalProtectedRoute, but we also
    // attempt an explicit navigation for immediate UX
    try {
      window.location.href = "/client/login";
    } catch {
      // fallback: ProtectedRoute will redirect
    }
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
