import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = getClientIP(req);
  const rl = checkRateLimit(`agent-booking:${ip}`, 20, 60);
  if (rl) return rateLimitResponse(rl.retryAfter, corsHeaders);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "";
    const slug: string = String(body?.slug ?? "").toLowerCase().trim();
    if (!slug) return json({ error: "Missing booking link" }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, full_name, job_title, avatar_url, booking_enabled, booking_timezone, booking_instructions, booking_contact_phone")
      .eq("booking_slug", slug)
      .maybeSingle();

    if (!profile || !profile.booking_enabled) {
      return json({ error: "This booking link is not active" }, 404);
    }

    // Public-safe agent shape — never expose commission or contact internals.
    const agent = {
      full_name: profile.full_name,
      job_title: profile.job_title,
      avatar_url: profile.avatar_url,
      timezone: profile.booking_timezone,
      instructions: profile.booking_instructions,
      phone: profile.booking_contact_phone,
    };

    if (action === "availability") {
      const nowIso = new Date().toISOString();
      const horizon = new Date(Date.now() + 35 * 86400000).toISOString();

      const [{ data: windows }, { data: blocks }, { data: meetings }] = await Promise.all([
        admin
          .from("agent_availability")
          .select("day_of_week, start_time, end_time, slot_minutes, buffer_minutes")
          .eq("user_id", profile.user_id),
        admin
          .from("agent_availability_blocks")
          .select("starts_at, ends_at")
          .eq("user_id", profile.user_id)
          .gte("ends_at", nowIso)
          .lte("starts_at", horizon),
        admin
          .from("agent_meetings")
          .select("starts_at, ends_at")
          .eq("user_id", profile.user_id)
          .eq("status", "scheduled")
          .gte("ends_at", nowIso)
          .lte("starts_at", horizon),
      ]);

      return json({
        agent,
        windows: windows ?? [],
        busy: [...(blocks ?? []), ...(meetings ?? [])],
      });
    }

    if (action === "book") {
      const startsAt = body?.starts_at;
      const endsAt = body?.ends_at;
      const name = String(body?.contact_name ?? "").trim();
      const email = String(body?.contact_email ?? "").trim().toLowerCase();

      if (!startsAt || !endsAt || !name || !email) {
        return json({ error: "Name, email and a time slot are required" }, 400);
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ error: "Please enter a valid email address" }, 400);
      }
      if (new Date(startsAt).getTime() < Date.now()) {
        return json({ error: "That time has already passed" }, 400);
      }

      // Reject double-booking of the same slot.
      const { data: clash } = await admin
        .from("agent_meetings")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("status", "scheduled")
        .lt("starts_at", endsAt)
        .gt("ends_at", startsAt)
        .maybeSingle();
      if (clash) return json({ error: "That time was just booked. Please pick another." }, 409);

      // Link to an existing client record when the email matches.
      const { data: client } = await admin
        .from("clients")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      const { data: created, error } = await admin
        .from("agent_meetings")
        .insert({
          user_id: profile.user_id,
          client_id: client?.id ?? null,
          contact_name: name,
          contact_email: email,
          contact_phone: body?.contact_phone ?? null,
          topic: body?.topic ?? null,
          notes: body?.notes ?? null,
          starts_at: startsAt,
          ends_at: endsAt,
          timezone: profile.booking_timezone,
        })
        .select("id, starts_at, ends_at")
        .single();
      if (error) throw error;

      await admin.from("agent_notifications").insert({
        user_id: profile.user_id,
        type: "meeting_booked",
        title: "New call booked",
        message: `${name} booked a call for ${new Date(startsAt).toLocaleString("en-US", {
          timeZone: profile.booking_timezone,
        })}`,
      });

      return json({ meeting: created, agent });
    }

    return json({ agent });
  } catch (err) {
    console.error("agent-booking error:", err instanceof Error ? err.message : err);
    return json({ error: "Internal error" }, 500);
  }
});