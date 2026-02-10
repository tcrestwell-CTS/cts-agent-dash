import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface PortalSession {
  clientId: string;
  clientName: string;
  token: string;
}

interface PortalContextType {
  session: PortalSession | null;
  loading: boolean;
  login: (token: string, clientId: string, clientName: string) => void;
  logout: () => void;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

const PORTAL_SESSION_KEY = "crestwell_portal_session";

export function PortalProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(PORTAL_SESSION_KEY);
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem(PORTAL_SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = (token: string, clientId: string, clientName: string) => {
    const s = { token, clientId, clientName };
    setSession(s);
    localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(s));
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem(PORTAL_SESSION_KEY);
  };

  return (
    <PortalContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalProvider");
  return ctx;
}
