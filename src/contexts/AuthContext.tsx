import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: User; session: Session }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        if (event === "SIGNED_OUT") {
          queryClient.clear();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    try {
      // Clear local session first so logout works even with stale/invalid sessions
      await supabase.auth.signOut({ scope: "local" });
      // Best-effort revoke across devices
      void supabase.auth.signOut({ scope: "global" });
    } catch {
      // Ignore and continue with local cleanup/redirect
    } finally {
      setUser(null);
      setSession(null);
      queryClient.clear();

      // Remove any persisted auth token keys left in storage
      const clearAuthKeys = (storage: Storage) => {
        for (let i = storage.length - 1; i >= 0; i--) {
          const key = storage.key(i);
          if (key?.startsWith("sb-") && key.endsWith("-auth-token")) {
            storage.removeItem(key);
          }
        }
      };
      clearAuthKeys(localStorage);
      clearAuthKeys(sessionStorage);

      window.location.replace("/auth");
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
