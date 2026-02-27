import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // === POST: Record terms acceptance with audit logging ===
    if (req.method === "POST") {
      const { token, signature, ip_address, user_agent } = await req.json();

      if (!token || !signature) {
        return new Response(JSON.stringify({ error: "token and signature required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: trip } = await supabase
        .from("trips")
        .select("id, user_id, trip_name, total_gross_sales, client_id")
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
      .select("id, trip_name, destination, depart_date, return_date, status, trip_type, notes, published_at, user_id, total_gross_sales, cover_image_url, deposit_required, deposit_amount, published_snapshot")
      .eq("share_token", token)
      .not("published_at", "is", null)
      .single();

    if (tripError || !trip) {
      return new Response(JSON.stringify({ error: "Trip not found or not published" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const snapshot = trip.published_snapshot as any;

    // Use snapshot data if available, otherwise fall back to live data
    let itinerary: any[] = [];
    let bookingsForResponse: any[] = [];
    let cancellationTerms: string[] = [];
    let paymentDeadlines: { label: string; date: string }[] = [];
    let optionBlocks: any[] = [];

    if (snapshot && snapshot.itinerary) {
      // Serve from frozen snapshot
      itinerary = snapshot.itinerary.map((item: any) => ({
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
      optionBlocks = snapshot.optionBlocks || [];
    } else {
      // Legacy fallback: serve live data for trips published before versioning
      const [itineraryRes, bookingsRes] = await Promise.all([
        supabase
          .from("itinerary_items")
          .select("id, day_number, title, description, category, start_time, end_time, location, item_date, notes, sort_order")
          .eq("trip_id", trip.id)
          .order("day_number", { ascending: true })
          .order("sort_order", { ascending: true }),
        supabase
          .from("bookings")
          .select("id, destination, depart_date, return_date, status, trip_name, cancellation_terms, payment_deadline, booking_type")
          .eq("trip_id", trip.id),
      ]);

      itinerary = itineraryRes.data || [];
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
    }

    // Fetch agent branding and profile (always live — not versioned)
    let branding = null;
    let advisor = null;

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

    return new Response(JSON.stringify({
      trip: {
        trip_name: trip.trip_name,
        destination: trip.destination,
        depart_date: trip.depart_date,
        return_date: trip.return_date,
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
      cancellationTerms,
      paymentDeadlines,
      itinerary,
      optionBlocks,
      bookings: bookingsForResponse,
      branding,
      advisor,
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
