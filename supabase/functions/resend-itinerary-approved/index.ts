import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const secret = Deno.env.get("MANUAL_NOTICE_SECRET") || Deno.env.get("CW_AGENT_SECRET");
    if (!secret || req.headers.get("x-agent-secret") !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tripId, itineraryId } = await req.json();
    if (!tripId) {
      return new Response(JSON.stringify({ error: "tripId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: trip } = await supabase
      .from("trips")
      .select("id, trip_name, user_id, client_id, approved_itinerary_id")
      .eq("id", tripId)
      .maybeSingle();
    if (!trip) {
      return new Response(JSON.stringify({ error: "Trip not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetItinId = itineraryId || trip.approved_itinerary_id;
    let itineraryName = "the itinerary";
    if (targetItinId) {
      const { data: itin } = await supabase.from("itineraries").select("name").eq("id", targetItinId).maybeSingle();
      if (itin?.name) itineraryName = itin.name;
    }

    let clientName = "Your client";
    if (trip.client_id) {
      const { data: client } = await supabase.from("clients").select("name").eq("id", trip.client_id).maybeSingle();
      if (client?.name) clientName = client.name;
    }

    const { data: agentUser } = await supabase.auth.admin.getUserById(trip.user_id);
    let agentEmail = agentUser?.user?.email as string | undefined;
    if (!agentEmail) {
      const { data: agentProfile } = await supabase
        .from("profiles").select("storefront_email").eq("id", trip.user_id).maybeSingle();
      agentEmail = agentProfile?.storefront_email || undefined;
    }
    if (!agentEmail) {
      return new Response(JSON.stringify({ error: "No agent email on file" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: branding } = await supabase
      .from("branding_settings")
      .select("agency_name, primary_color, logo_url, from_email, from_name")
      .eq("user_id", trip.user_id)
      .maybeSingle();

    const agencyName = branding?.agency_name || "Crestwell Travel Services";
    const primaryColor = branding?.primary_color || "#0D7377";
    const fromEmail = branding?.from_email || "send@crestwellgetaways.com";
    const fromName = branding?.from_name || agencyName;

    let baseUrl = Deno.env.get("PORTAL_BASE_URL") || "https://app.crestwelltravels.com";
    if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;
    const dashboardUrl = baseUrl.replace(/\/client.*$/, "").replace(/\/+$/, "");

    const subject = `✅ ${clientName} approved "${itineraryName}" — ${trip.trip_name}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width:600px; margin:0 auto; padding:24px;">
        ${branding?.logo_url ? `<div style="text-align:center;margin-bottom:24px;"><img src="${branding.logo_url}" alt="${agencyName}" style="max-height:60px;" /></div>` : ""}
        <h2 style="color:${primaryColor};margin-bottom:8px;">✅ Itinerary Approved!</h2>
        <p style="color:#374151;font-size:16px;line-height:1.6;"><strong>${clientName}</strong> approved the itinerary <strong>"${itineraryName}"</strong> for <strong>${trip.trip_name}</strong>.</p>
        <p style="color:#374151;font-size:16px;line-height:1.6;">You can now proceed with confirming bookings and next steps for this trip.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${dashboardUrl}/trips/${trip.id}" style="background-color:${primaryColor};color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">View Trip Details</a>
        </div>
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:14px;">${agencyName}</div>
      </div>`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [agentEmail], subject, html }),
    });
    const resJson = await res.json().catch(() => null);

    await supabase.from("email_logs").insert({
      user_id: trip.user_id,
      client_id: trip.client_id,
      to_email: agentEmail,
      subject,
      template: "itinerary_approved_agent",
      status: res.ok ? "sent" : "failed",
      error_message: res.ok ? null : JSON.stringify(resJson),
      provider_message_id: resJson?.id || null,
      metadata: { trip_id: trip.id, itinerary_id: targetItinId, source: "resend-itinerary-approved" },
    });

    if (!res.ok) {
      console.error("Resend error", res.status, JSON.stringify(resJson));
      return new Response(JSON.stringify({ error: "Provider request failed", status: res.status, details: resJson }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, sentTo: agentEmail, subject }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
