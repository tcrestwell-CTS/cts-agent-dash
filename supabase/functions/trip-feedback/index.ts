import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clampRating = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
};

const clean = (v: unknown, max = 4000) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token") || "";
    let payload: Record<string, unknown> = {};

    if (req.method === "POST") {
      payload = await req.json().catch(() => ({}));
      token = (payload.token as string) || token;
    }

    if (!token || token.length < 8 || token.length > 64) {
      return json({ error: "Invalid link" }, 400);
    }

    const { data: feedback } = await supabase
      .from("trip_feedback")
      .select("id, trip_id, client_id, submitted_at, overall_rating")
      .eq("token", token)
      .maybeSingle();

    if (!feedback) return json({ error: "Survey link not found or expired" }, 404);

    const { data: trip } = await supabase
      .from("trips")
      .select("trip_name, destination, return_date, user_id")
      .eq("id", feedback.trip_id)
      .maybeSingle();

    const { data: client } = feedback.client_id
      ? await supabase
          .from("clients")
          .select("first_name, preferred_first_name, name")
          .eq("id", feedback.client_id)
          .maybeSingle()
      : { data: null };

    const { data: branding } = trip?.user_id
      ? await supabase
          .from("branding_settings")
          .select("agency_name, logo_url, primary_color, accent_color")
          .eq("user_id", trip.user_id)
          .maybeSingle()
      : { data: null };

    const context = {
      tripName: trip?.trip_name ?? "your trip",
      destination: trip?.destination ?? null,
      returnDate: trip?.return_date ?? null,
      clientName:
        client?.preferred_first_name || client?.first_name || client?.name || null,
      agencyName: branding?.agency_name || "Crestwell Travel Services",
      logoUrl: branding?.logo_url || null,
      primaryColor: branding?.primary_color || null,
      alreadySubmitted: Boolean(feedback.submitted_at),
    };

    if (req.method === "GET") return json({ ok: true, ...context });

    if (feedback.submitted_at) {
      return json({ ok: true, alreadySubmitted: true, ...context });
    }

    const overall = clampRating(payload.overall_rating);
    if (!overall) return json({ error: "Please provide an overall rating from 1 to 5" }, 400);

    const { error: updateError } = await supabase
      .from("trip_feedback")
      .update({
        overall_rating: overall,
        accommodations_rating: clampRating(payload.accommodations_rating),
        activities_rating: clampRating(payload.activities_rating),
        communication_rating: clampRating(payload.communication_rating),
        value_rating: clampRating(payload.value_rating),
        review_text: clean(payload.review_text),
        private_comments: clean(payload.private_comments),
        would_recommend:
          typeof payload.would_recommend === "boolean" ? payload.would_recommend : null,
        allow_public_use: payload.allow_public_use === true,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", feedback.id);

    if (updateError) {
      console.error("trip-feedback update failed", updateError);
      return json({ error: "Could not save your feedback" }, 500);
    }

    if (trip?.user_id) {
      await supabase.from("agent_notifications").insert({
        user_id: trip.user_id,
        client_id: feedback.client_id,
        type: "trip_feedback",
        title: `New trip review — ${overall}/5`,
        message: `${context.clientName || "A client"} submitted feedback for ${context.tripName}.`,
        trip_id: feedback.trip_id,
      });
    }

    return json({ ok: true, submitted: true, ...context, alreadySubmitted: true });
  } catch (error) {
    console.error("trip-feedback error", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
