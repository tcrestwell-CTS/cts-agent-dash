import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface QBOConnectionStatus {
  connected: boolean;
  needs_reconnect?: boolean;
  refreshed?: boolean;
  connection: {
    realm_id: string;
    company_name: string | null;
    is_active: boolean;
    token_expires_at: string;
    created_at: string;
  } | null;
}

/** Helper: get auth headers for edge function calls */
async function getAuthHeaders() {
  const session = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session.data.session?.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

/** Helper: call an edge function with auto-retry on 401 (token refresh then retry once) */
async function qboFetchWithRetry(
  url: string,
  options: RequestInit,
  onNeedsReconnect: () => void
): Promise<Response> {
  const resp = await fetch(url, options);

  if (resp.status === 401) {
    // Attempt a token refresh
    const headers = await getAuthHeaders();
    const refreshResp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-auth?action=refresh`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );

    if (refreshResp.ok) {
      // Retry original request
      const retryHeaders = await getAuthHeaders();
      const retryOptions = {
        ...options,
        headers: {
          ...(options.headers || {}),
          ...retryHeaders,
        },
      };
      return fetch(url, retryOptions);
    } else {
      // Refresh failed — need full reconnect
      onNeedsReconnect();
      return resp;
    }
  }

  return resp;
}

// Refresh interval: check every 45 minutes
const REFRESH_CHECK_INTERVAL = 45 * 60 * 1000;

export function useQBOConnection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<QBOConnectionStatus>({ connected: false, connection: null });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showReconnectToast = useCallback(() => {
    toast.error("QuickBooks connection expired", {
      duration: 15000,
      description: "Your QuickBooks token could not be refreshed. Please reconnect.",
      action: {
        label: "Reconnect",
        onClick: () => {
          window.location.href = "/settings?tab=integrations";
        },
      },
    });
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-auth?action=status`,
        { headers }
      );
      if (!resp.ok) throw new Error("Failed to fetch QBO status");
      const data: QBOConnectionStatus = await resp.json();
      setStatus(data);

      if (data.needs_reconnect) {
        showReconnectToast();
      }
      if (data.refreshed) {
        console.log("QBO token was auto-refreshed by server");
      }
    } catch (err) {
      console.error("Failed to fetch QBO status:", err);
    } finally {
      setLoading(false);
    }
  }, [user, showReconnectToast]);

  // Initial fetch + periodic refresh check
  useEffect(() => {
    fetchStatus();

    // Set up periodic status check (triggers server-side auto-refresh)
    refreshTimerRef.current = setInterval(fetchStatus, REFRESH_CHECK_INTERVAL);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchStatus]);

  const connect = async (): Promise<{ error?: string; current_origin?: string; allowed_origins?: string[]; redirect_uri?: string; allowed_redirect_uris?: string[] } | void> => {
    try {
      const redirectUri = `${window.location.origin}/settings?tab=integrations`;
      const headers = await getAuthHeaders();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-auth?action=authorize&redirect_uri=${encodeURIComponent(redirectUri)}`,
        { headers }
      );

      const result = await resp.json();

      if (!resp.ok) {
        if (result.error === "redirect_uri_mismatch" || result.error === "redirect_uri_exact_mismatch") {
          const exactUri = result.redirect_uri || redirectUri;
          toast.error("QuickBooks Redirect URI Mismatch", {
            duration: 15000,
            description: `Origin "${result.current_origin || window.location.origin}" is not registered. Add the URI below to your Intuit app's Redirect URIs and to QBO_ALLOWED_ORIGINS.`,
            action: {
              label: "Copy URI",
              onClick: () => {
                navigator.clipboard.writeText(exactUri);
                toast.success("Copied to clipboard");
              },
            },
          });
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
      
      sessionStorage.setItem("qbo_oauth_state", result.state);

      // Use popup to avoid iframe cookie-blocking issues
      const popup = window.open(result.auth_url, "qbo_oauth", "width=600,height=700,scrollbars=yes");
      if (!popup) {
        // Popup blocked — fall back to redirect
        window.location.href = result.auth_url;
        return;
      }

      // Poll the popup for the OAuth callback params
      const pollInterval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(pollInterval);
            return;
          }
          const popupUrl = popup.location.href;
          if (popupUrl && popupUrl.includes("code=")) {
            clearInterval(pollInterval);
            const url = new URL(popupUrl);
            const code = url.searchParams.get("code");
            const realmId = url.searchParams.get("realmId");
            const state = url.searchParams.get("state");
            popup.close();
            if (code && realmId && state) {
              handleCallback(code, realmId, state);
            }
          }
        } catch {
          // Cross-origin — popup hasn't redirected back yet, keep polling
        }
      }, 500);
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
      const headers = await getAuthHeaders();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-auth?action=callback`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
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
      const headers = await getAuthHeaders();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-auth?action=disconnect`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
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
      const headers = await getAuthHeaders();
      const resp = await qboFetchWithRetry(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=sync-clients`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ client_ids: clientIds }),
        },
        showReconnectToast
      );
      if (!resp.ok) throw new Error("Sync clients failed");
      const data = await resp.json();
      toast.success(`Synced clients: ${data.created} created, ${data.updated} updated`);
      await fetchStatus();
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
      const headers = await getAuthHeaders();
      const resp = await qboFetchWithRetry(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=sync-invoice`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_id: invoiceId }),
        },
        showReconnectToast
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
      const headers = await getAuthHeaders();
      const resp = await qboFetchWithRetry(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=sync-payments`,
        {
          method: "POST",
          headers: { ...headers },
        },
        showReconnectToast
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
      const headers = await getAuthHeaders();
      const resp = await qboFetchWithRetry(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=financial-summary`,
        { headers },
        showReconnectToast
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