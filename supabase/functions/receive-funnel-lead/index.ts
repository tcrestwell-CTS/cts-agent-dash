import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://cts-funnels.vercel.app",
  "https://crestwellgetaways.com",
  "https://www.crestwellgetaways.com",
];

function buildCors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, cors);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRe.test(email)) {
    return json({ error: "Valid email is required" }, 400, cors);
  }
  if (!body.first_name && !body.last_name) {
    return json({ error: "Name is required" }, 400, cors);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Check for active duplicate by email
  const { data: existing, error: lookupErr } = await supabase
    .from("quote_requests")
    .select("id, status")
    .ilike("email", email)
    .not("status", "in", "(booked,closed)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupErr) {
    console.error("lookup error", lookupErr);
    return json({ error: "Lookup failed" }, 500, cors);
  }

  const utmPatch: Record<string, any> = {};
  if (body.utm_source) utmPatch.utm_source = body.utm_source;
  if (body.utm_medium) utmPatch.utm_medium = body.utm_medium;
  if (body.utm_campaign) utmPatch.utm_campaign = body.utm_campaign;

  if (existing) {
    const updatePayload: Record<string, any> = { ...utmPatch };
    if (body.message) updatePayload.message = body.message;
    if (body.funnel_id) updatePayload.funnel_id = body.funnel_id;
    if (body.funnel_name) updatePayload.funnel_name = body.funnel_name;
    if (body.funnel_slug) updatePayload.funnel_slug = body.funnel_slug;
    if (body.raw_answers) updatePayload.raw_answers = body.raw_answers;

    if (Object.keys(updatePayload).length > 0) {
      await supabase.from("quote_requests").update(updatePayload).eq("id", existing.id);
    }
    return json({ id: existing.id, duplicate: true }, 200, cors);
  }

  // 2. Insert new lead
  const insertPayload = {
    first_name: String(body.first_name ?? "").trim() || "Guest",
    last_name: String(body.last_name ?? "").trim() || "",
    email,
    phone: body.phone ?? null,
    destination: body.destination ?? null,
    travelers_adults: Number.isFinite(Number(body.travelers_adults))
      ? Number(body.travelers_adults)
      : 2,
    budget: body.budget ?? null,
    trip_type: body.trip_type ?? "Other",
    message: body.message ?? null,
    lead_source: body.lead_source ?? "funnel",
    utm_source: body.utm_source ?? null,
    utm_medium: body.utm_medium ?? null,
    utm_campaign: body.utm_campaign ?? null,
    funnel_id: body.funnel_id ?? null,
    funnel_name: body.funnel_name ?? null,
    funnel_slug: body.funnel_slug ?? null,
    raw_answers: body.raw_answers ?? null,
    status: "new",
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("quote_requests")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("insert error", insertErr);
    return json({ error: "Insert failed" }, 500, cors);
  }

  // 3. Trigger Tiara qualification (fire-and-forget)
  try {
    fetch(`${SUPABASE_URL}/functions/v1/qualify-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ lead_id: inserted.id }),
    }).catch((e) => console.error("Tiara trigger failed", e));
  } catch (e) {
    console.error("Tiara dispatch error", e);
  }

  // 4. Notify the agency owner. Funnel/website leads stay unassigned on purpose.
  try {
    fetch(`${SUPABASE_URL}/functions/v1/notify-lead-assigned`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ lead_id: inserted.id }),
    }).catch((e) => console.error("Owner notification failed", e));
  } catch (e) {
    console.error("Owner notification dispatch error", e);
  }

  return json({ id: inserted.id, duplicate: false }, 200, cors);
});