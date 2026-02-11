import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function getToken() {
  try {
    const stored = localStorage.getItem("portal_session");
    return stored ? JSON.parse(stored).token : null;
  } catch {
    return null;
  }
}

async function portalFetch(resource: string, params?: Record<string, string>) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const searchParams = new URLSearchParams({ resource, ...params });
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?${searchParams.toString()}`;
  const res = await fetch(url, {
    headers: {
      "x-portal-token": token,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

async function portalPost(resource: string, body: any) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?resource=${resource}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-portal-token": token,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

export function usePortalDashboard() {
  return useQuery({
    queryKey: ["portal", "dashboard"],
    queryFn: () => portalFetch("dashboard"),
    staleTime: 30_000,
  });
}

export function usePortalTrips() {
  return useQuery({
    queryKey: ["portal", "trips"],
    queryFn: () => portalFetch("trips"),
    staleTime: 30_000,
  });
}

export function usePortalTripDetail(tripId: string | undefined) {
  return useQuery({
    queryKey: ["portal", "trip-detail", tripId],
    queryFn: () => portalFetch("trip-detail", { tripId: tripId! }),
    enabled: !!tripId,
    staleTime: 30_000,
  });
}

export function usePortalInvoices() {
  return useQuery({
    queryKey: ["portal", "invoices"],
    queryFn: () => portalFetch("invoices"),
    staleTime: 30_000,
  });
}

export function usePortalMessages() {
  return useQuery({
    queryKey: ["portal", "messages"],
    queryFn: () => portalFetch("messages"),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useSendPortalMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => portalPost("messages", { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "messages"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "dashboard"] });
    },
  });
}
