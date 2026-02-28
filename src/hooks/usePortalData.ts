import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// NOTE: Portal data hooks use raw fetch instead of supabase.functions.invoke
// because portal-data is a GET endpoint with query params, which invoke() doesn't
// support natively. The portal uses its own token-based auth (x-portal-token)
// rather than Supabase JWT auth.

function getToken(): string | null {
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

async function portalPost(resource: string, body: Record<string, unknown>) {
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
  const token = getToken();
  return useQuery({
    queryKey: ["portal", "dashboard"],
    queryFn: () => portalFetch("dashboard"),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function usePortalTrips() {
  const token = getToken();
  return useQuery({
    queryKey: ["portal", "trips"],
    queryFn: () => portalFetch("trips"),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function usePortalTripDetail(tripId: string | undefined) {
  const token = getToken();
  return useQuery({
    queryKey: ["portal", "trip-detail", tripId],
    queryFn: () => portalFetch("trip-detail", { tripId: tripId! }),
    enabled: !!tripId && !!token,
    staleTime: 30_000,
  });
}

export function usePortalInvoices() {
  const token = getToken();
  return useQuery({
    queryKey: ["portal", "invoices"],
    queryFn: () => portalFetch("invoices"),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function usePortalPayments() {
  const token = getToken();
  return useQuery({
    queryKey: ["portal", "payments"],
    queryFn: () => portalFetch("payments"),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function usePortalInvoiceDetail(invoiceId: string | undefined) {
  const token = getToken();
  return useQuery({
    queryKey: ["portal", "invoice-detail", invoiceId],
    queryFn: () => portalFetch("invoice-detail", { invoiceId: invoiceId! }),
    enabled: !!invoiceId && !!token,
    staleTime: 30_000,
  });
}

export function usePortalMessages() {
  const token = getToken();
  return useQuery({
    queryKey: ["portal", "messages"],
    queryFn: () => portalFetch("messages"),
    enabled: !!token,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
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

export function useApproveItinerary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, itineraryId }: { tripId: string; itineraryId: string }) =>
      portalPost("approve-itinerary", { tripId, itineraryId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["portal", "trip-detail", variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ["portal", "dashboard"] });
    },
  });
}

export function usePortalCCAuthorizations(tripId: string | undefined) {
  const token = getToken();
  return useQuery({
    queryKey: ["portal", "cc-authorizations", tripId],
    queryFn: () => portalFetch("cc-authorizations", { tripId: tripId! }),
    enabled: !!tripId && !!token,
    staleTime: 30_000,
  });
}

export function usePortalDocChecklist(tripId: string | undefined) {
  const token = getToken();
  return useQuery({
    queryKey: ["portal", "doc-checklist", tripId],
    queryFn: () => portalFetch("doc-checklist", { tripId: tripId! }),
    enabled: !!tripId && !!token,
    staleTime: 30_000,
  });
}

export function usePortalOptionSelections(tripId: string | undefined) {
  const token = getToken();
  return useQuery({
    queryKey: ["portal", "option-selections", tripId],
    queryFn: () => portalFetch("option-selections", { tripId: tripId! }),
    enabled: !!tripId && !!token,
    staleTime: 30_000,
  });
}

export function useSelectOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, optionBlockId, selectedItemId }: {
      tripId: string;
      optionBlockId: string;
      selectedItemId: string;
    }) => portalPost("select-option", { tripId, optionBlockId, selectedItemId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["portal", "option-selections", variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ["portal", "trip-detail", variables.tripId] });
    },
  });
}
