import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const parseLocalDate = (value?: string | null) => {
  if (!value) return null;

  const parsed = new Date(DATE_ONLY_REGEX.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toCalendarDayStamp = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

const getTripDayCount = (departDate?: string | null, returnDate?: string | null) => {
  const start = parseLocalDate(departDate);
  const end = parseLocalDate(returnDate);

  if (!start || !end) return null;

  return Math.max(Math.round((toCalendarDayStamp(end) - toCalendarDayStamp(start)) / MILLISECONDS_PER_DAY) + 1, 1);
};

const normalizeText = (value: unknown) => String(value ?? "").trim().toLowerCase();

const normalizeDayNumber = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const normalized = Math.trunc(numeric);
  return normalized >= 1 ? normalized : null;
};

const filterToActiveItinerary = <T extends { itinerary_id?: string | null }>(entries: T[], activeItineraryId?: string | null) => {
  if (!activeItineraryId) return entries;

  return entries.some((entry) => entry.itinerary_id === activeItineraryId)
    ? entries.filter((entry) => entry.itinerary_id === activeItineraryId)
    : entries;
};

const sanitizeItinerary = (items: any[], totalDays: number | null) => {
  const seen = new Set<string>();

  return items
    .map((item) => {
      const dayNumber = normalizeDayNumber(item?.day_number);
      return dayNumber ? { ...item, day_number: dayNumber } : null;
    })
    .filter(Boolean)
    .filter((item: any) => !totalDays || item.day_number <= totalDays)
    .sort(
      (a: any, b: any) =>
        Number(a.day_number) - Number(b.day_number) ||
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    )
    .filter((item: any) => {
      const key = [
        item.day_number,
        normalizeText(item.title),
        normalizeText(item.description),
        normalizeText(item.location),
        normalizeText(item.start_time),
        normalizeText(item.end_time),
        normalizeText(item.category),
        normalizeText(item.option_block_id),
      ].join("|");

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const sanitizeOptionBlocks = (blocks: any[], totalDays: number | null) => {
  const seen = new Set<string>();

  return blocks
    .map((block) => {
      const dayNumber = normalizeDayNumber(block?.day_number);
      return dayNumber ? { ...block, day_number: dayNumber } : null;
    })
    .filter(Boolean)
    .filter((block: any) => !totalDays || block.day_number <= totalDays)
    .sort(
      (a: any, b: any) =>
        Number(a.day_number) - Number(b.day_number) ||
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    )
    .filter((block: any) => {
      const key = [
        normalizeText(block.id),
        block.day_number,
        normalizeText(block.title),
        Number(block.sort_order ?? 0),
      ].join("|");

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getActiveSnapshotItinerary = (snapshot: any) => {
  const itineraries = Array.isArray(snapshot?.itineraries) ? [...snapshot.itineraries] : [];
  itineraries.sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0));
  return itineraries[0] || null;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // === POST: Handle terms acceptance, budget confirmation, or budget change request ===
    if (req.method === "POST") {
      const body = await req.json();
      const { token, action } = body;

      if (!token) {
        return new Response(JSON.stringify({ error: "token required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: trip } = await supabase
        .from("trips")
        .select("id, user_id, trip_name, total_gross_sales, client_id, budget_range, approved_itinerary_id")
        .eq("share_token", token)
        .not("published_at", "is", null)
        .single();

      if (!trip) {
        return new Response(JSON.stringify({ error: "Trip not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let clientName = "Client";
      if (trip.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", trip.client_id)
          .single();
        if (client) clientName = client.name;
      }

      // === Client selects an itinerary option from the proposal ===
      if (action === "select_itinerary") {
        const { itinerary_id, ip_address, user_agent } = body;
        if (!itinerary_id) {
          return new Response(JSON.stringify({ error: "itinerary_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Validate the itinerary belongs to this trip
        const { data: itin } = await supabase
          .from("itineraries")
          .select("id, name")
          .eq("id", itinerary_id)
          .eq("trip_id", trip.id)
          .maybeSingle();

        if (!itin) {
          return new Response(JSON.stringify({ error: "Itinerary not found for this trip" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // If already approved, do nothing
        if (trip.approved_itinerary_id && trip.approved_itinerary_id === itinerary_id) {
          return new Response(JSON.stringify({ success: true, alreadySelected: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("trips")
          .update({
            approved_itinerary_id: itinerary_id,
            itinerary_approved_at: new Date().toISOString(),
            itinerary_approved_by_client_id: trip.client_id,
          })
          .eq("id", trip.id);

        // Audit log
        await supabase.from("compliance_audit_log").insert({
          user_id: trip.user_id,
          event_type: "itinerary_selected",
          entity_type: "trip",
          entity_id: trip.id,
          client_name: clientName,
          ip_address: ip_address || null,
          user_agent: user_agent || null,
          metadata: {
            trip_name: trip.trip_name,
            itinerary_id,
            itinerary_name: itin.name,
          },
        });

        // Notify agent
        await supabase.from("agent_notifications").insert({
          user_id: trip.user_id,
          type: "itinerary_selected",
          title: `Itinerary Chosen: ${clientName}`,
          message: `${clientName} selected "${itin.name || "an itinerary"}" for "${trip.trip_name}". It's now the active itinerary in their client portal.`,
          trip_id: trip.id,
        });

        // Portal message
        if (trip.client_id) {
          await supabase.from("portal_messages").insert({
            client_id: trip.client_id,
            agent_user_id: trip.user_id,
            sender_type: "client",
            message: `✅ ${clientName} chose "${itin.name || "an itinerary"}" for "${trip.trip_name}".`,
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // === Create CC Authorization for "Send Card Info to Agent" ===
      if (action === "create_cc_auth") {
        const { amount } = body;
        // Find first booking for this trip
        const { data: tripBookings } = await supabase
          .from("bookings")
          .select("id")
          .eq("trip_id", trip.id)
          .limit(1);

        const bookingId = tripBookings?.[0]?.id;
        if (!bookingId) {
          return new Response(JSON.stringify({ error: "No bookings found for this trip" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check for existing pending CC auth
        const { data: existingAuth } = await supabase
          .from("cc_authorizations")
          .select("id, access_token")
          .eq("user_id", trip.user_id)
          .eq("client_id", trip.client_id)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle();

        let ccAccessToken: string;
        if (existingAuth) {
          ccAccessToken = existingAuth.access_token;
        } else {
          const { data: newAuth, error: authErr } = await supabase
            .from("cc_authorizations")
            .insert({
              booking_id: bookingId,
              client_id: trip.client_id,
              user_id: trip.user_id,
              authorization_amount: amount || trip.total_gross_sales || 0,
              authorization_description: `Payment for ${trip.trip_name}`,
              status: "pending",
            })
            .select("access_token")
            .single();

          if (authErr || !newAuth) {
            console.error("CC auth creation error:", authErr);
            return new Response(JSON.stringify({ error: "Failed to create authorization" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          ccAccessToken = newAuth.access_token;
        }

        // Notify agent
        await supabase.from("agent_notifications").insert({
          user_id: trip.user_id,
          type: "payment_method_selected",
          title: "Payment Method Selected",
          message: `${clientName} chose "Send Card Info to Agent" for "${trip.trip_name}".`,
          trip_id: trip.id,
        });

        // Portal message
        if (trip.client_id) {
          await supabase.from("portal_messages").insert({
            client_id: trip.client_id,
            agent_user_id: trip.user_id,
            sender_type: "client",
            message: `💳 ${clientName} selected "Send Card Info to Agent" for "${trip.trip_name}".`,
          });
        }

        // Workflow task
        await supabase.from("workflow_tasks").insert({
          trip_id: trip.id,
          user_id: trip.user_id,
          title: `CC Authorization from ${clientName}`,
          description: `${clientName} is submitting their card info for "${trip.trip_name}".`,
          task_type: "cc_authorization_request",
          status: "pending",
        } as any);

        return new Response(JSON.stringify({ success: true, ccAccessToken }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // === Budget Confirmation (e-signature) ===
      if (action === "confirm_budget") {
        const { signature, ip_address, user_agent } = body;
        if (!signature) {
          return new Response(JSON.stringify({ error: "signature required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("trips")
          .update({
            budget_confirmed: true,
            budget_confirmed_at: new Date().toISOString(),
            budget_confirmed_by_client_id: trip.client_id,
            budget_confirmation_signature: signature,
            budget_confirmation_ip: ip_address || null,
            budget_confirmation_user_agent: user_agent || null,
            budget_change_requested: false,
            budget_change_request_message: null,
            budget_change_requested_at: null,
            budget_change_requested_by_client_id: null,
          })
          .eq("id", trip.id);

        // Audit log
        await supabase.from("compliance_audit_log").insert({
          user_id: trip.user_id,
          event_type: "budget_confirmed",
          entity_type: "trip",
          entity_id: trip.id,
          client_name: clientName,
          ip_address: ip_address || null,
          user_agent: user_agent || null,
          signature,
          metadata: {
            trip_name: trip.trip_name,
            budget_range: trip.budget_range,
          },
        });

        // Notify agent
        await supabase.from("agent_notifications").insert({
          user_id: trip.user_id,
          type: "budget_confirmed",
          title: `Budget Confirmed: ${clientName}`,
          message: `${clientName} has confirmed the budget (${trip.budget_range || "N/A"}) for "${trip.trip_name}".`,
          trip_id: trip.id,
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // === Budget Change Request ===
      if (action === "request_budget_change") {
        const { message } = body;
        if (!message?.trim()) {
          return new Response(JSON.stringify({ error: "message required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("trips")
          .update({
            budget_confirmed: false,
            budget_confirmed_at: null,
            budget_confirmation_signature: null,
            budget_change_requested: true,
            budget_change_request_message: message.trim(),
            budget_change_requested_at: new Date().toISOString(),
            budget_change_requested_by_client_id: trip.client_id,
          })
          .eq("id", trip.id);

        // Audit log
        await supabase.from("compliance_audit_log").insert({
          user_id: trip.user_id,
          event_type: "budget_change_requested",
          entity_type: "trip",
          entity_id: trip.id,
          client_name: clientName,
          metadata: {
            trip_name: trip.trip_name,
            budget_range: trip.budget_range,
            change_message: message.trim(),
          },
        });

        // Notify agent
        await supabase.from("agent_notifications").insert({
          user_id: trip.user_id,
          type: "budget_change_request",
          title: `Budget Change Request: ${clientName}`,
          message: `${clientName} requested a budget change for "${trip.trip_name}": ${message.trim()}`,
          trip_id: trip.id,
        });

        // Also send as portal message if client exists
        if (trip.client_id) {
          await supabase.from("portal_messages").insert({
            agent_user_id: trip.user_id,
            client_id: trip.client_id,
            sender_type: "client",
            message: `Budget change request for "${trip.trip_name}": ${message.trim()}`,
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // === Legacy: Terms acceptance (no action field) ===
      const { signature, ip_address, user_agent } = body;
      if (!signature) {
        return new Response(JSON.stringify({ error: "signature required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("trip_payments")
        .update({
          terms_accepted_at: new Date().toISOString(),
          acceptance_signature: signature,
        })
        .eq("trip_id", trip.id)
        .eq("status", "pending");

      await supabase.from("compliance_audit_log").insert({
        user_id: trip.user_id,
        event_type: "terms_accepted",
        entity_type: "trip",
        entity_id: trip.id,
        client_name: clientName,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
        signature,
        metadata: {
          trip_name: trip.trip_name,
          total_cost: trip.total_gross_sales,
        },
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === GET: Fetch shared trip data ===

    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find trip by share token, only if published
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, trip_name, destination, depart_date, return_date, status, trip_type, notes, published_at, user_id, total_gross_sales, cover_image_url, deposit_required, deposit_amount, published_snapshot, budget_range, budget_confirmed, budget_confirmed_at, budget_change_requested, budget_change_request_message, approved_itinerary_id, itinerary_approved_at")
      .eq("share_token", token)
      .not("published_at", "is", null)
      .single();

    if (tripError || !trip) {
      return new Response(JSON.stringify({ error: "Trip not found or not published" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stamp quote funnel: viewed_at + view_count for the latest sent quote on this trip
    try {
      const { data: latestQuote } = await supabase
        .from("quotes")
        .select("id, viewed_at, view_count")
        .eq("trip_id", trip.id)
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestQuote) {
        await supabase
          .from("quotes")
          .update({
            viewed_at: latestQuote.viewed_at ?? new Date().toISOString(),
            view_count: (latestQuote.view_count ?? 0) + 1,
          })
          .eq("id", latestQuote.id);
      }
    } catch (_) {
      // non-fatal: never block the public view on telemetry
    }

    const snapshot = trip.published_snapshot as any;

    // Use snapshot data if available, otherwise fall back to live data
    let itinerary: any[] = [];
    let bookingsForResponse: any[] = [];
    let cancellationTerms: string[] = [];
    let paymentDeadlines: { label: string; date: string }[] = [];
    let optionBlocks: any[] = [];
    let itinerariesList: any[] = [];
    let effectiveDepartDate = trip.depart_date;
    let effectiveReturnDate = trip.return_date;

    const hasSnapshotItineraries =
      snapshot && Array.isArray(snapshot.itineraries) && snapshot.itineraries.length > 0;
    const hasSnapshotItems =
      snapshot && Array.isArray(snapshot.itinerary) && snapshot.itinerary.length > 0;

    if (hasSnapshotItineraries || hasSnapshotItems) {
      const activeSnapshotItinerary = getActiveSnapshotItinerary(snapshot);
      const totalDays = getTripDayCount(
        activeSnapshotItinerary?.depart_date ?? trip.depart_date,
        activeSnapshotItinerary?.return_date ?? trip.return_date
      );

      effectiveDepartDate = activeSnapshotItinerary?.depart_date ?? trip.depart_date;
      effectiveReturnDate = activeSnapshotItinerary?.return_date ?? trip.return_date;

      // Serve from frozen snapshot
      itinerary = sanitizeItinerary(
        filterToActiveItinerary(Array.isArray(snapshot.itinerary) ? snapshot.itinerary : [], activeSnapshotItinerary?.id),
        totalDays
      ).map((item: any) => ({
        id: item.id,
        day_number: item.day_number,
        title: item.title,
        description: item.description,
        category: item.category,
        start_time: item.start_time,
        end_time: item.end_time,
        location: item.location,
        item_date: item.item_date,
        notes: item.notes,
        sort_order: item.sort_order,
        option_block_id: item.option_block_id ?? null,
        item_price: item.item_price ?? null,
      }));

      bookingsForResponse = (snapshot.bookings || []).map((b: any) => ({
        destination: b.destination,
        depart_date: b.depart_date,
        return_date: b.return_date,
        status: b.status,
        trip_name: b.trip_name,
        booking_type: b.booking_type,
      }));

      (snapshot.bookings || []).forEach((b: any) => {
        if (b.cancellation_terms) cancellationTerms.push(b.cancellation_terms);
        if (b.payment_deadline) {
          paymentDeadlines.push({
            label: `${b.trip_name || b.destination || "Booking"} payment deadline`,
            date: b.payment_deadline,
          });
        }
      });
      optionBlocks = sanitizeOptionBlocks(
        filterToActiveItinerary(Array.isArray(snapshot.optionBlocks) ? snapshot.optionBlocks : [], activeSnapshotItinerary?.id),
        totalDays
      );

      // Build per-itinerary list from snapshot
      const snapshotItineraries = Array.isArray(snapshot.itineraries) ? snapshot.itineraries : [];
      const snapshotItems = Array.isArray(snapshot.itinerary) ? snapshot.itinerary : [];
      const snapshotBlocks = Array.isArray(snapshot.optionBlocks) ? snapshot.optionBlocks : [];
      itinerariesList = snapshotItineraries
        .slice()
        .sort((a: any, b: any) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0))
        .map((it: any) => {
          const itDays = getTripDayCount(
            it?.depart_date ?? trip.depart_date,
            it?.return_date ?? trip.return_date
          );
          return {
            id: it.id,
            name: it.name || "Itinerary",
            overview: it.overview ?? null,
            cover_image_url: it.cover_image_url ?? null,
            depart_date: it.depart_date ?? null,
            return_date: it.return_date ?? null,
            sort_order: it.sort_order ?? 0,
            items: sanitizeItinerary(
              snapshotItems.filter((x: any) => x?.itinerary_id === it.id),
              itDays
            ),
            optionBlocks: sanitizeOptionBlocks(
              snapshotBlocks.filter((x: any) => x?.itinerary_id === it.id),
              itDays
            ),
          };
        });
      // Pricing from snapshot if available
    }

    if (itinerariesList.length === 0) {
      // Legacy fallback: serve live data for trips published before versioning
      // First get the active itinerary to filter items properly
      const allItinRes = await supabase
        .from("itineraries")
        .select("id, name, overview, cover_image_url, depart_date, return_date, sort_order")
        .eq("trip_id", trip.id)
        .order("sort_order", { ascending: true });
      if (allItinRes.error) throw allItinRes.error;

      const allItineraries = allItinRes.data || [];
      const activeItinerary = allItineraries[0] || null;
      const activeItineraryId = activeItinerary?.id || null;
      const totalDays = getTripDayCount(
        activeItinerary?.depart_date ?? trip.depart_date,
        activeItinerary?.return_date ?? trip.return_date
      );

      effectiveDepartDate = activeItinerary?.depart_date ?? trip.depart_date;
      effectiveReturnDate = activeItinerary?.return_date ?? trip.return_date;

      const [itineraryRes, bookingsRes, optionBlocksRes] = await Promise.all([
        supabase
          .from("itinerary_items")
          .select("id, day_number, title, description, category, start_time, end_time, location, item_date, notes, sort_order, option_block_id, itinerary_id, item_price")
          .eq("trip_id", trip.id)
          .order("day_number", { ascending: true })
          .order("sort_order", { ascending: true }),
        supabase
          .from("bookings")
          .select("id, destination, depart_date, return_date, status, trip_name, cancellation_terms, payment_deadline, booking_type, gross_sales, travelers")
          .eq("trip_id", trip.id),
        supabase
          .from("option_blocks")
          .select("id, trip_id, day_number, title, sort_order, itinerary_id")
          .eq("trip_id", trip.id)
          .order("sort_order", { ascending: true }),
      ]);

      if (itineraryRes.error) throw itineraryRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (optionBlocksRes.error) throw optionBlocksRes.error;

      const allItems = (itineraryRes.data as any[]) || [];
      const allBlocks = (optionBlocksRes.data as any[]) || [];
      itinerary = sanitizeItinerary(
        filterToActiveItinerary(allItems, activeItineraryId),
        totalDays
      );
      const bookings = bookingsRes.data || [];

      bookingsForResponse = bookings.map((b: any) => ({
        destination: b.destination,
        depart_date: b.depart_date,
        return_date: b.return_date,
        status: b.status,
        trip_name: b.trip_name,
        booking_type: b.booking_type,
      }));

      bookings.forEach((b: any) => {
        if (b.cancellation_terms) cancellationTerms.push(b.cancellation_terms);
        if (b.payment_deadline) {
          paymentDeadlines.push({
            label: `${b.trip_name || b.destination || "Booking"} payment deadline`,
            date: b.payment_deadline,
          });
        }
      });

      optionBlocks = sanitizeOptionBlocks(
        filterToActiveItinerary(allBlocks, activeItineraryId),
        totalDays
      );

      // Build per-itinerary list from live data so clients can pick
      itinerariesList = allItineraries.map((it: any) => {
        const itDays = getTripDayCount(
          it?.depart_date ?? trip.depart_date,
          it?.return_date ?? trip.return_date
        );
        return {
          id: it.id,
          name: it.name || "Itinerary",
          overview: it.overview ?? null,
          cover_image_url: it.cover_image_url ?? null,
          depart_date: it.depart_date ?? null,
          return_date: it.return_date ?? null,
          sort_order: it.sort_order ?? 0,
          items: sanitizeItinerary(
            allItems.filter((x: any) => x?.itinerary_id === it.id),
            itDays
          ),
          optionBlocks: sanitizeOptionBlocks(
            allBlocks.filter((x: any) => x?.itinerary_id === it.id),
            itDays
          ),
        };
      });
    }

    // Fetch pricing lines (client-facing sell prices only)
    let pricingLines: any[] = [];
    const { data: tripBookingIds } = await supabase
      .from("bookings")
      .select("id, trip_name, travelers, gross_sales")
      .eq("trip_id", trip.id);

    if (tripBookingIds?.length) {
      const bIds = tripBookingIds.map((b: any) => b.id);
      const { data: marginLines } = await supabase
        .from("booking_margin_lines")
        .select("id, booking_id, description, line_type, unit_sell, quantity, total_sell, is_pass_through, sort_order, deposit_amount, is_optional, is_internal")
        .in("booking_id", bIds)
        .order("sort_order", { ascending: true });

      // Map visible lines as-is; collapse internal lines into one synthetic
      // "Package" line per booking so the client sees a single rolled-up
      // base price instead of internal cost items.
      const visibleLines: any[] = [];
      const internalTotalsByBooking: Record<string, { total: number; deposit: number }> = {};

      (marginLines || []).forEach((l: any) => {
        const parentBooking = tripBookingIds.find((b: any) => b.id === l.booking_id);
        if (l.is_internal) {
          const acc = internalTotalsByBooking[l.booking_id] || { total: 0, deposit: 0 };
          acc.total += Number(l.total_sell || 0);
          acc.deposit += Number(l.deposit_amount || 0);
          internalTotalsByBooking[l.booking_id] = acc;
          return;
        }
        visibleLines.push({
          id: l.id,
          booking_id: l.booking_id,
          booking_name: parentBooking?.trip_name || "",
          description: l.description,
          line_type: l.line_type,
          unit_price: l.unit_sell,
          quantity: l.quantity,
          total_price: l.total_sell,
          is_addon: l.is_pass_through || l.line_type === "addon",
          sort_order: l.sort_order,
          travelers: parentBooking?.travelers || 1,
          deposit_amount: l.deposit_amount || 0,
          is_optional: l.is_optional || false,
        });
      });

      // Prepend a single rolled-up Package line per booking that has internals.
      Object.entries(internalTotalsByBooking).forEach(([bookingId, totals]) => {
        const parentBooking = tripBookingIds.find((b: any) => b.id === bookingId);
        visibleLines.unshift({
          id: `internal-rollup-${bookingId}`,
          booking_id: bookingId,
          booking_name: parentBooking?.trip_name || "",
          description: "Package",
          line_type: "package",
          unit_price: totals.total,
          quantity: 1,
          total_price: totals.total,
          is_addon: false,
          sort_order: -1,
          travelers: parentBooking?.travelers || 1,
          deposit_amount: totals.deposit,
          is_optional: false,
        });
      });

      pricingLines = visibleLines;
    }
    let branding = null;
    let advisor = null;
    let termsAccepted = false;

    // Check if terms have been accepted for this trip
    const { data: termsLog } = await supabase
      .from("compliance_audit_log")
      .select("id")
      .eq("entity_id", trip.id)
      .eq("entity_type", "trip")
      .eq("event_type", "terms_accepted")
      .limit(1);
    if (termsLog && termsLog.length > 0) {
      termsAccepted = true;
    }

    if (trip.user_id) {
      const [brandingRes, profileRes] = await Promise.all([
        supabase
          .from("branding_settings")
          .select("agency_name, primary_color, accent_color, logo_url, tagline, email_address, phone, website")
          .eq("user_id", trip.user_id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name, avatar_url, agency_name, job_title, phone, clia_number, ccra_number, asta_number, embarc_number")
          .eq("user_id", trip.user_id)
          .maybeSingle(),
      ]);

      branding = brandingRes.data;
      if (profileRes.data) {
        advisor = {
          name: profileRes.data.full_name,
          avatar_url: profileRes.data.avatar_url,
          agency_name: profileRes.data.agency_name || branding?.agency_name,
          job_title: profileRes.data.job_title,
          phone: profileRes.data.phone || branding?.phone,
          email: branding?.email_address,
          website: branding?.website,
          clia_number: profileRes.data.clia_number,
          ccra_number: profileRes.data.ccra_number,
          asta_number: profileRes.data.asta_number,
          embarc_number: profileRes.data.embarc_number,
        };
      }
    }

    cancellationTerms = [...new Set(cancellationTerms)];

    // If client has already chosen an itinerary, only expose that one
    // so the proposal page (and downstream portal) hides the others.
    if (trip.approved_itinerary_id && itinerariesList.length > 1) {
      const chosen = itinerariesList.find((it: any) => it.id === trip.approved_itinerary_id);
      if (chosen) itinerariesList = [chosen];
    }

    return new Response(JSON.stringify({
      trip: {
        trip_name: trip.trip_name,
        destination: trip.destination,
        depart_date: effectiveDepartDate,
        return_date: effectiveReturnDate,
        status: trip.status,
        trip_type: trip.trip_type,
        notes: trip.notes,
        total_cost: trip.total_gross_sales,
        cover_image_url: trip.cover_image_url,
      },
      deposit: {
        required: trip.deposit_required || false,
        amount: trip.deposit_amount || 0,
      },
      budget: {
        range: trip.budget_range,
        confirmed: trip.budget_confirmed || false,
        confirmed_at: trip.budget_confirmed_at,
        change_requested: trip.budget_change_requested || false,
        change_request_message: trip.budget_change_request_message,
      },
      cancellationTerms,
      paymentDeadlines,
      itinerary,
      optionBlocks,
      itineraries: itinerariesList,
      bookings: bookingsForResponse,
      pricingLines,
      branding,
      advisor,
      termsAccepted,
      approvedItineraryId: trip.approved_itinerary_id || null,
      itineraryApprovedAt: trip.itinerary_approved_at || null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Shared trip error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
