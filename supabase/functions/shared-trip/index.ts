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
      .select("id, trip_name, destination, depart_date, return_date, status, trip_type, notes, published_at, user_id, total_gross_sales, cover_image_url, deposit_required, deposit_amount")
      .eq("share_token", token)
      .not("published_at", "is", null)
      .single();

    if (tripError || !trip) {
      return new Response(JSON.stringify({ error: "Trip not found or not published" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch itinerary items, bookings in parallel
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

    const itinerary = itineraryRes.data;
    const bookings = bookingsRes.data;

    // Fetch agent branding and profile in parallel
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

    // Build cancellation terms and payment deadlines from bookings
    const cancellationTerms: string[] = [];
    const paymentDeadlines: { label: string; date: string }[] = [];
    (bookings || []).forEach((b: any) => {
      if (b.cancellation_terms) cancellationTerms.push(b.cancellation_terms);
      if (b.payment_deadline) {
        paymentDeadlines.push({
          label: `${b.trip_name || b.destination || "Booking"} payment deadline`,
          date: b.payment_deadline,
        });
      }
    });

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
      cancellationTerms: [...new Set(cancellationTerms)],
      paymentDeadlines,
      itinerary: itinerary || [],
      bookings: (bookings || []).map((b: any) => ({
        destination: b.destination,
        depart_date: b.depart_date,
        return_date: b.return_date,
        status: b.status,
        trip_name: b.trip_name,
        booking_type: b.booking_type,
      })),
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
