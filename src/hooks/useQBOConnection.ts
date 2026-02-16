import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface QBOConnectionStatus {
  connected: boolean;
  connection: {
    realm_id: string;
    company_name: string | null;
    is_active: boolean;
    token_expires_at: string;
    created_at: string;
  } | null;
}

export function useQBOConnection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<QBOConnectionStatus>({ connected: false, connection: null });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-auth?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!resp.ok) throw new Error("Failed to fetch QBO status");
      const data = await resp.json();
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch QBO status:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const connect = async (): Promise<{ error?: string; current_origin?: string; allowed_origins?: string[]; redirect_uri?: string; allowed_redirect_uris?: string[] } | void> => {
    try {
      const redirectUri = `${window.location.origin}/settings?tab=integrations`;
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-auth?action=authorize&redirect_uri=${encodeURIComponent(redirectUri)}`,
        {
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await resp.json();

      if (!resp.ok) {
        if (result.error === "redirect_uri_mismatch" || result.error === "redirect_uri_exact_mismatch") {
          const exactUri = result.redirect_uri || redirectUri;
          toast.error(
            `Redirect URI mismatch. The exact URI "${exactUri}" must be listed in your Intuit app's Redirect URIs section.`,
            { duration: 12000 }
          );
          return {
            error: result.error,
            current_origin: result.current_origin,
            allowed_origins: result.allowed_origins,
            redirect_uri: result.redirect_uri,
            allowed_redirect_uris: result.allowed_redirect_uris,
          };
        }
        throw new Error(result.error || "Failed to get authorization URL");
      }
      
      // Store state for validation
      sessionStorage.setItem("qbo_oauth_state", result.state);
      
      // Redirect to QBO
      window.location.href = result.auth_url;
    } catch (err) {
      console.error("QBO connect error:", err);
      toast.error("Failed to start QuickBooks connection");
    }
  };

  const handleCallback = async (code: string, realmId: string, state: string) => {
    const savedState = sessionStorage.getItem("qbo_oauth_state");
    if (savedState && savedState !== state) {
      toast.error("Invalid OAuth state. Please try again.");
      return false;
    }
    sessionStorage.removeItem("qbo_oauth_state");

    try {
      const redirectUri = `${window.location.origin}/settings?tab=integrations`;
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-auth?action=callback`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, redirect_uri: redirectUri, realm_id: realmId }),
        }
      );

      if (!resp.ok) throw new Error("Callback failed");
      const data = await resp.json();
      toast.success(`Connected to QuickBooks: ${data.company_name || "Success"}`);
      await fetchStatus();
      return true;
    } catch (err) {
      console.error("QBO callback error:", err);
      toast.error("Failed to complete QuickBooks connection");
      return false;
    }
  };

  const disconnect = async () => {
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-auth?action=disconnect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      if (!resp.ok) throw new Error("Disconnect failed");
      setStatus({ connected: false, connection: null });
      toast.success("Disconnected from QuickBooks");
    } catch (err) {
      console.error("QBO disconnect error:", err);
      toast.error("Failed to disconnect from QuickBooks");
    }
  };

  const syncClients = async (clientIds?: string[]) => {
    setSyncing("clients");
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=sync-clients`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ client_ids: clientIds }),
        }
      );
      if (!resp.ok) throw new Error("Sync clients failed");
      const data = await resp.json();
      toast.success(`Synced clients: ${data.created} created, ${data.updated} updated`);
      return data;
    } catch (err) {
      console.error("Client sync error:", err);
      toast.error("Failed to sync clients to QuickBooks");
    } finally {
      setSyncing(null);
    }
  };

  const syncInvoice = async (invoiceId: string) => {
    setSyncing("invoice");
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=sync-invoice`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invoice_id: invoiceId }),
        }
      );
      if (!resp.ok) throw new Error("Sync invoice failed");
      const data = await resp.json();
      toast.success("Invoice synced to QuickBooks");
      return data;
    } catch (err) {
      console.error("Invoice sync error:", err);
      toast.error("Failed to sync invoice to QuickBooks");
    } finally {
      setSyncing(null);
    }
  };

  const syncPayments = async () => {
    setSyncing("payments");
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=sync-payments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      if (!resp.ok) throw new Error("Sync payments failed");
      const data = await resp.json();
      toast.success(`Payment sync: ${data.matched} matched of ${data.total_payments} QBO payments`);
      return data;
    } catch (err) {
      console.error("Payment sync error:", err);
      toast.error("Failed to sync payments from QuickBooks");
    } finally {
      setSyncing(null);
    }
  };

  const getFinancialSummary = async () => {
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=financial-summary`,
        {
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!resp.ok) throw new Error("Failed to fetch financial summary");
      return await resp.json();
    } catch (err) {
      console.error("Financial summary error:", err);
      toast.error("Failed to fetch QuickBooks financial summary");
      return null;
    }
  };

  return {
    status,
    loading,
    syncing,
    connect,
    handleCallback,
    disconnect,
    syncClients,
    syncInvoice,
    syncPayments,
    getFinancialSummary,
    refreshStatus: fetchStatus,
  };
}
