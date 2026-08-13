import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function getPreviewClientContext(clientId: string) {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientError) throw clientError;
  if (!client) throw new Error("Client not found");

  let allClientIds = [clientId];

  if (client.email) {
    const { data: siblings, error: siblingsError } = await supabase
      .from("clients")
      .select("id")
      .eq("email", client.email);

    if (siblingsError) throw siblingsError;

    allClientIds = [
      ...new Set([clientId, ...(siblings || []).map((s: any) => s.id).filter(Boolean)]),
    ];
  }

  const companionTripIdSet = new Set<string>();

  if (client.email) {
    const { data: companions, error: companionsError } = await supabase
      .from("client_companions")
      .select("id")
      .eq("email", client.email);

    if (companionsError) throw companionsError;

    const companionIds = (companions || []).map((companion: any) => companion.id);

    if (companionIds.length > 0) {
      const { data: travelerLinks, error: travelerLinksError } = await supabase
        .from("booking_travelers")
        .select("booking_id")
        .in("companion_id", companionIds);

      if (travelerLinksError) throw travelerLinksError;

      const bookingIds = [
        ...new Set((travelerLinks || []).map((link: any) => link.booking_id).filter(Boolean)),
      ];

      if (bookingIds.length > 0) {
        const { data: companionBookings, error: companionBookingsError } = await supabase
          .from("bookings")
          .select("trip_id")
          .in("id", bookingIds)
          .not("trip_id", "is", null);

        if (companionBookingsError) throw companionBookingsError;

        (companionBookings || []).forEach((b: any) => {
          if (b.trip_id) companionTripIdSet.add(b.trip_id);
        });
      }
    }
  }

  // Also include trips where this client is a trip_traveler (by linked_client_id or email)
  const orFilters: string[] = [`linked_client_id.in.(${allClientIds.join(",")})`];
  if (client.email) orFilters.push(`email.eq.${client.email}`);
  const { data: tripTravelers, error: tripTravelersError } = await supabase
    .from("trip_travelers")
    .select("trip_id")
    .or(orFilters.join(","));
  if (tripTravelersError) throw tripTravelersError;
  (tripTravelers || []).forEach((t: any) => {
    if (t.trip_id) companionTripIdSet.add(t.trip_id);
  });

  return { client, allClientIds, companionTripIds: [...companionTripIdSet] };
}

function sortTripsByDepartDateDesc(a: any, b: any) {
  return new Date(b?.depart_date || 0).getTime() - new Date(a?.depart_date || 0).getTime();
}

async function getAccessibleTrips(clientId: string, selectClause = "*") {
  const { client, allClientIds, companionTripIds } = await getPreviewClientContext(clientId);

  const { data: ownTripsData, error: ownTripsError } = await supabase
    .from("trips")
    .select(selectClause)
    .in("client_id", allClientIds)
    .neq("status", "archived")
    .neq("status", "cancelled");

  if (ownTripsError) throw ownTripsError;

  const ownTrips = (ownTripsData || []) as any[];
  const ownTripIds = new Set(ownTrips.map((trip) => trip.id));
  const extraTripIds = companionTripIds.filter((id) => !ownTripIds.has(id));

  let companionTrips: any[] = [];
  if (extraTripIds.length > 0) {
    const { data: companionTripsData, error: companionTripsError } = await supabase
      .from("trips")
      .select(selectClause)
      .in("id", extraTripIds)
      .neq("status", "archived")
      .neq("status", "cancelled");

    if (companionTripsError) throw companionTripsError;
    companionTrips = (companionTripsData || []) as any[];
  }

  return {
    client,
    allClientIds,
    companionTripIds,
    trips: [...ownTrips, ...companionTrips].sort(sortTripsByDepartDateDesc),
  };
}

/**
 * Fetches portal-equivalent data for admin preview of a client's portal.
 * Mirrors the same trip access rules as the client portal.
 */
export function useAdminPortalDashboard(clientId: string | undefined) {
  return useQuery({
    queryKey: ["admin-portal-preview", "dashboard", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("No client ID");

      const { client, trips } = await getAccessibleTrips(clientId);
      const tripIds = trips.map((trip: any) => trip.id);

      let payments: any[] = [];
      if (tripIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("trip_payments" as any)
          .select("*")
          .in("trip_id", tripIds)
          .eq("status", "pending")
          .order("due_date", { ascending: true });

        if (paymentsError) throw paymentsError;
        payments = (paymentsData as any[]) || [];
      }

      let agent = null;
      if (client.user_id) {
        const { data: agentData, error: agentError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", client.user_id)
          .single();

        if (agentError && agentError.code !== "PGRST116") throw agentError;
        agent = agentData;
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

      const { trips } = await getAccessibleTrips(clientId);
      return { trips };
    },
    enabled: !!clientId,
  });
}

export function useAdminPortalTripDetail(clientId: string | undefined, tripId: string | undefined) {
  return useQuery({
    queryKey: ["admin-portal-preview", "trip-detail", clientId, tripId],
    queryFn: async () => {
      if (!clientId || !tripId) throw new Error("Missing params");

      const { allClientIds, companionTripIds } = await getPreviewClientContext(clientId);

      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();

      if (tripError) throw tripError;

      const isCompanionTrip = companionTripIds.includes(tripId);
      if (!trip || (!allClientIds.includes(trip.client_id) && !isCompanionTrip)) {
        return {
          trip: null,
          bookings: [],
          payments: [],
          itinerary: [],
          itineraries: [],
          optionBlocks: [],
          pricingLines: [],
        };
      }

      const [bookingsRes, paymentsRes, itinerariesRes, itineraryRes, optionBlocksRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, confirmation_number, status, total_price, gross_sales, supplier_id, suppliers(name, supplier_type)")
          .eq("trip_id", tripId)
          .neq("status", "cancelled")
          .neq("status", "archived")
          .order("created_at", { ascending: true }),
        supabase
          .from("trip_payments" as any)
          .select("*")
          .eq("trip_id", tripId)
          .order("due_date", { ascending: true }),
        supabase
          .from("itineraries")
          .select("*")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: true }),
        supabase
          .from("itinerary_items")
          .select("*")
          .eq("trip_id", tripId)
          .order("day_number", { ascending: true })
          .order("sort_order", { ascending: true }),
        supabase
          .from("option_blocks")
          .select("*")
          .eq("trip_id", tripId)
          .order("day_number", { ascending: true }),
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (itinerariesRes.error) throw itinerariesRes.error;
      if (itineraryRes.error) throw itineraryRes.error;
      if (optionBlocksRes.error) throw optionBlocksRes.error;

      // Transform bookings to portal shape (mirrors portal-data edge function)
      const supplierTypeToBookingType = (st: string | null): string => {
        if (!st) return "other";
        const map: Record<string, string> = {
          airline: "flight", hotel: "hotel", cruise: "cruise",
          car_rental: "car_rental", tour_operator: "tour", insurance: "insurance",
          transfer: "transfer", dmc: "tour",
        };
        return map[st.toLowerCase()] || "other";
      };

      const rawBookings = bookingsRes.data || [];
      const bookings = rawBookings.map((b: any) => ({
        id: b.id,
        booking_reference: b.confirmation_number,
        booking_type: supplierTypeToBookingType(b.suppliers?.supplier_type),
        destination: trip?.destination || "",
        depart_date: trip?.depart_date,
        return_date: trip?.return_date,
        status: b.status,
        total_amount: b.gross_sales || b.total_price || 0,
        travelers: 1,
        trip_name: b.suppliers?.name || trip?.trip_name || "",
        supplier_id: b.supplier_id,
        gross_sales: b.gross_sales,
      }));
      const bookingIds = bookings.map((booking: any) => booking.id);
      let pricingLines: any[] = [];

      if (bookingIds.length > 0) {
        const { data: marginLines, error: marginLinesError } = await supabase
          .from("booking_margin_lines")
          .select("*")
          .in("booking_id", bookingIds)
          .order("sort_order", { ascending: true });

        if (marginLinesError) throw marginLinesError;

        pricingLines = (marginLines || []).map((line: any) => ({
          ...line,
          unit_price: line.unit_sell,
          is_addon: line.is_pass_through || line.line_type === "addon",
        }));
      }

      return {
        trip,
        bookings,
        payments: (paymentsRes.data as any[]) || [],
        itinerary: itineraryRes.data || [],
        itineraries: itinerariesRes.data || [],
        optionBlocks: optionBlocksRes.data || [],
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

      const { trips } = await getAccessibleTrips(
        clientId,
        "id, trip_name, total_gross_sales, departure_date, itinerary_approved_at, budget_confirmed"
      );
      const tripIds = trips.map((trip: any) => trip.id);

      if (tripIds.length === 0) return { payments: [], balances: [] };

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("trip_payments" as any)
        .select("*")
        .in("trip_id", tripIds)
        .order("due_date", { ascending: true });

      if (paymentsError) throw paymentsError;

      const tripNameMap = Object.fromEntries(
        trips.map((trip: any) => [trip.id, trip.trip_name])
      );

      const payments = (paymentsData as any[]) || [];
      const balances = trips.map((trip: any) => {
        const tripPayments = payments.filter((payment: any) => payment.trip_id === trip.id);
        const paid = tripPayments
          .filter((payment: any) => payment.status === "paid")
          .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
        const scheduled = tripPayments
          .filter((payment: any) => ["pending", "authorized"].includes(payment.status))
          .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
        const total = Number(trip.total_gross_sales || 0);

        return {
          trip_id: trip.id,
          trip_name: trip.trip_name || "Trip",
          total,
          paid,
          scheduled,
          outstanding: Math.max(0, Math.round((total - paid - scheduled) * 100) / 100),
          departure_date: trip.departure_date,
          unlocked: !!trip.itinerary_approved_at || !!trip.budget_confirmed,
        };
      }).filter((balance: any) => balance.outstanding > 0);

      return {
        payments: payments.map((payment: any) => ({
          ...payment,
          trip_name: tripNameMap[payment.trip_id] || "",
        })),
        balances,
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

      const { allClientIds } = await getPreviewClientContext(clientId);

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .in("client_id", allClientIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
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

      const { data, error } = await supabase
        .from("portal_messages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return { messages: data || [] };
    },
    enabled: !!clientId,
  });
}

export function useAdminPortalDocuments(clientId: string | undefined) {
  return useQuery({
    queryKey: ["admin-portal-preview", "documents", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("No client ID");

      const { trips } = await getAccessibleTrips(clientId, "id, trip_name");
      const tripIds = trips.map((t: any) => t.id);
      if (tripIds.length === 0) return { groups: [] };

      const { data: docs, error } = await supabase
        .from("client_document_uploads")
        .select("*")
        .in("trip_id", tripIds)
        .not("uploaded_by", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const withUrls = await Promise.all(
        (docs || []).map(async (d: any) => {
          let url: string | null = null;
          if (d.file_path) {
            const { data: signed } = await supabase.storage
              .from("client-documents")
              .createSignedUrl(d.file_path, 3600);
            url = signed?.signedUrl || null;
          }
          return { ...d, url };
        })
      );

      const groups = trips
        .map((t: any) => ({
          trip_id: t.id,
          trip_name: t.trip_name,
          docs: withUrls.filter((d: any) => d.trip_id === t.id),
        }))
        .filter((g: any) => g.docs.length > 0);

      return { groups };
    },
    enabled: !!clientId,
  });
}
