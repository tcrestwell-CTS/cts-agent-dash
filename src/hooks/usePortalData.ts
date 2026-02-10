import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePortal } from "@/contexts/PortalContext";
import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function portalFetch(resource: string, token: string, params?: Record<string, string>, method = "GET", body?: any) {
  const url = new URL(`${FUNCTIONS_URL}/portal-data`);
  url.searchParams.set("resource", resource);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-portal-token": token,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

export function usePortalDashboard() {
  const { session } = usePortal();
  return useQuery({
    queryKey: ["portal", "dashboard"],
    queryFn: () => portalFetch("dashboard", session!.token),
    enabled: !!session,
  });
}

export function usePortalTrips() {
  const { session } = usePortal();
  return useQuery({
    queryKey: ["portal", "trips"],
    queryFn: () => portalFetch("trips", session!.token),
    enabled: !!session,
  });
}

export function usePortalTripDetail(tripId: string) {
  const { session } = usePortal();
  return useQuery({
    queryKey: ["portal", "trip", tripId],
    queryFn: () => portalFetch("trip-detail", session!.token, { tripId }),
    enabled: !!session && !!tripId,
  });
}

export function usePortalInvoices() {
  const { session } = usePortal();
  return useQuery({
    queryKey: ["portal", "invoices"],
    queryFn: () => portalFetch("invoices", session!.token),
    enabled: !!session,
  });
}

export function usePortalMessages() {
  const { session } = usePortal();
  return useQuery({
    queryKey: ["portal", "messages"],
    queryFn: () => portalFetch("messages", session!.token),
    enabled: !!session,
    refetchInterval: 15000,
  });
}

export function useSendPortalMessage() {
  const { session } = usePortal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) =>
      portalFetch("messages", session!.token, undefined, "POST", { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "messages"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "dashboard"] });
    },
  });
}
