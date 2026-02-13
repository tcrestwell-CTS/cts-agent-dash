import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      .select("id, trip_name, destination, depart_date, return_date, status, trip_type, notes, published_at")
      .eq("share_token", token)
      .not("published_at", "is", null)
      .single();

    if (tripError || !trip) {
      return new Response(JSON.stringify({ error: "Trip not found or not published" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch itinerary items
    const { data: itinerary } = await supabase
      .from("itinerary_items")
      .select("id, day_number, title, description, category, start_time, end_time, location, item_date, notes, sort_order")
      .eq("trip_id", trip.id)
      .order("day_number", { ascending: true })
      .order("sort_order", { ascending: true });

    // Fetch bookings (limited public info)
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, destination, depart_date, return_date, status, trip_name")
      .eq("trip_id", trip.id);

    // Fetch agent branding
    const { data: tripFull } = await supabase
      .from("trips")
      .select("user_id")
      .eq("id", trip.id)
      .single();

    let branding = null;
    if (tripFull?.user_id) {
      const { data } = await supabase
        .from("branding_settings")
        .select("agency_name, primary_color, accent_color, logo_url, tagline")
        .eq("user_id", tripFull.user_id)
        .maybeSingle();
      branding = data;
    }

    return new Response(JSON.stringify({
      trip: {
        trip_name: trip.trip_name,
        destination: trip.destination,
        depart_date: trip.depart_date,
        return_date: trip.return_date,
        status: trip.status,
        trip_type: trip.trip_type,
        notes: trip.notes,
      },
      itinerary: itinerary || [],
      bookings: (bookings || []).map((b: any) => ({
        destination: b.destination,
        depart_date: b.depart_date,
        return_date: b.return_date,
        status: b.status,
        trip_name: b.trip_name,
      })),
      branding,
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
