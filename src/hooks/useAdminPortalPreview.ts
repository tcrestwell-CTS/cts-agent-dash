import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches portal-equivalent data for admin preview of a client's portal.
 * Uses direct Supabase queries (admin RLS allows access).
 */

export function useAdminPortalDashboard(clientId: string | undefined) {
  return useQuery({
    queryKey: ["admin-portal-preview", "dashboard", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("No client ID");

      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      const { data: tripTravelers } = await supabase
        .from("trip_travelers")
        .select("trip_id")
        .eq("client_id", clientId);

      const tripIds = (tripTravelers || []).map((t: any) => t.trip_id);

      let trips: any[] = [];
      if (tripIds.length > 0) {
        const { data } = await supabase
          .from("trips")
          .select("*")
          .in("id", tripIds)
          .order("depart_date", { ascending: true });
        trips = data || [];
      }

      let payments: any[] = [];
      if (tripIds.length > 0) {
        const { data } = await supabase
          .from("trip_payments" as any)
          .select("*")
          .in("trip_id", tripIds)
          .eq("status", "pending")
          .order("due_date", { ascending: true });
        payments = (data as any[]) || [];
      }

      let agent = null;
      if (client?.user_id) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", client.user_id)
          .single();
        agent = data;
      }

      return { client, trips, upcoming_payments: payments, agent, unread_messages: 0 };
    },
    enabled: !!clientId,
  });
}

export function useAdminPortalTrips(clientId: string | undefined) {
  return useQuery({
    queryKey: ["admin-portal-preview", "trips", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("No client ID");

      const { data: tripTravelers } = await (supabase
        .from("trip_travelers") as any)
        .select("trip_id")
        .eq("client_id", clientId);

      const tripIds = ((tripTravelers || []) as any[]).map((t) => t.trip_id);
      if (tripIds.length === 0) return { trips: [] };

      const { data } = await supabase
        .from("trips")
        .select("*")
        .in("id", tripIds)
        .order("depart_date", { ascending: true });

      return { trips: data || [] };
    },
    enabled: !!clientId,
  });
}

export function useAdminPortalTripDetail(clientId: string | undefined, tripId: string | undefined) {
  return useQuery({
    queryKey: ["admin-portal-preview", "trip-detail", clientId, tripId],
    queryFn: async () => {
      if (!clientId || !tripId) throw new Error("Missing params");

      const { data: trip } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();

      const { data: bookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });

      const { data: payments } = await supabase
        .from("trip_payments" as any)
        .select("*")
        .eq("trip_id", tripId)
        .order("due_date", { ascending: true });

      const { data: itineraries } = await supabase
        .from("itineraries")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });

      const { data: itinerary } = await supabase
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true })
        .order("sort_order", { ascending: true });

      const { data: optionBlocks } = await supabase
        .from("option_blocks")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true });

      const bookingIds = (bookings || []).map((b: any) => b.id);
      let pricingLines: any[] = [];
      if (bookingIds.length > 0) {
        const { data } = await supabase
          .from("booking_margin_lines")
          .select("*")
          .in("booking_id", bookingIds)
          .order("sort_order", { ascending: true });
        pricingLines = (data || []).map((l: any) => ({
          ...l,
          unit_price: l.unit_sell,
          is_addon: l.is_pass_through || l.line_type === "addon",
        }));
      }

      return {
        trip,
        bookings: bookings || [],
        payments: (payments as any[]) || [],
        itinerary: itinerary || [],
        itineraries: itineraries || [],
        optionBlocks: optionBlocks || [],
        pricingLines,
      };
    },
    enabled: !!clientId && !!tripId,
  });
}

export function useAdminPortalPayments(clientId: string | undefined) {
  return useQuery({
    queryKey: ["admin-portal-preview", "payments", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("No client ID");

      const { data: tripTravelers } = await supabase
        .from("trip_travelers")
        .select("trip_id")
        .eq("client_id", clientId);

      const tripIds = (tripTravelers || []).map((t: any) => t.trip_id);
      if (tripIds.length === 0) return { payments: [] };

      // Fetch payments and trips separately to avoid type issues
      const { data: paymentsData } = await supabase
        .from("trip_payments" as any)
        .select("*")
        .in("trip_id", tripIds)
        .order("due_date", { ascending: true });

      const { data: tripsData } = await supabase
        .from("trips")
        .select("id, trip_name")
        .in("id", tripIds);

      const tripNameMap = Object.fromEntries(
        (tripsData || []).map((t: any) => [t.id, t.trip_name])
      );

      return {
        payments: ((paymentsData as any[]) || []).map((p: any) => ({
          ...p,
          trip_name: tripNameMap[p.trip_id] || "",
        })),
      };
    },
    enabled: !!clientId,
  });
}

export function useAdminPortalInvoices(clientId: string | undefined) {
  return useQuery({
    queryKey: ["admin-portal-preview", "invoices", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("No client ID");

      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      return { invoices: data || [] };
    },
    enabled: !!clientId,
  });
}

export function useAdminPortalMessages(clientId: string | undefined) {
  return useQuery({
    queryKey: ["admin-portal-preview", "messages", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("No client ID");

      const { data } = await supabase
        .from("portal_messages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      return { messages: data || [] };
    },
    enabled: !!clientId,
  });
}
