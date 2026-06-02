// Hotelbeds Content API nightly sync — cert requirement.
// Pages through /hotel-content-api/1.0/hotels and upserts into public.hotelbeds_hotels.
// Triggered by pg_cron or admin "Sync Now" button.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HB_ENV = Deno.env.get("HOTELBEDS_ENV") || "test";
const HB_CONTENT_BASE =
  HB_ENV === "live"
    ? "https://api.hotelbeds.com/hotel-content-api/1.0"
    : "https://api.test.hotelbeds.com/hotel-content-api/1.0";
const MTLS_PROXY_URL = Deno.env.get("HOTELBEDS_MTLS_PROXY_URL");
const MTLS_PROXY_TOKEN = Deno.env.get("HOTELBEDS_MTLS_PROXY_TOKEN");

async function sig(apiKey: string, secret: string) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey + secret + ts),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchPage(from: number, to: number, lang: string) {
  const apiKey = Deno.env.get("HOTELBEDS_API_KEY")!;
  const apiSecret = Deno.env.get("HOTELBEDS_API_SECRET")!;
  const headers = {
    "Api-key": apiKey,
    "X-Signature": await sig(apiKey, apiSecret),
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "Content-Type": "application/json",
  };
  const path = `/hotels?fields=all&language=${lang}&from=${from}&to=${to}&useSecondaryLanguage=false`;

  if (HB_ENV === "live" && MTLS_PROXY_URL && MTLS_PROXY_TOKEN) {
    const r = await fetch(MTLS_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-proxy-token": MTLS_PROXY_TOKEN },
      body: JSON.stringify({ targetUrl: path, method: "GET", apiBase: "content", headers }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `HB ${r.status}`);
    return data;
  }

  const r = await fetch(`${HB_CONTENT_BASE}${path}`, { method: "GET", headers });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `HB ${r.status}`);
  return data;
}

function mapHotel(h: any) {
  const phones = Array.isArray(h.phones) ? h.phones : [];
  const addr = h.address?.content || h.address?.street || "";
  return {
    code: h.code,
    name: h.name?.content || h.name || "",
    country_code: h.countryCode || null,
    destination_code: h.destinationCode || null,
    destination_name: h.destinationName?.content || h.destinationName || null,
    zone_code: h.zoneCode ? String(h.zoneCode) : null,
    city: h.city?.content || h.city || null,
    state_code: h.stateCode || null,
    address: typeof addr === "string" ? addr : addr?.content || null,
    postal_code: h.postalCode || null,
    latitude: h.coordinates?.latitude ?? null,
    longitude: h.coordinates?.longitude ?? null,
    phones,
    email: h.email || null,
    web: h.web || null,
    category_code: h.categoryCode || null,
    category_name: h.categoryGroupCode || null,
    chain_code: h.chainCode || null,
    accommodation_type_code: h.accommodationTypeCode || null,
    description: h.description?.content || null,
    images: h.images || null,
    facilities: h.facilities || null,
    raw: h,
    last_synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Allow either cron secret or signed-in admin
  const cronSecret = req.headers.get("x-automation-secret");
  const authHeader = req.headers.get("Authorization");
  let triggeredBy = "cron";

  if (cronSecret !== Deno.env.get("AUTOMATION_SECRET_KEY")) {
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    triggeredBy = `admin:${user.id}`;
  }

  const body = await req.json().catch(() => ({}));
  const lang = body.language || "ENG";
  const pageSize = Math.min(body.pageSize || 1000, 1000);
  const maxPages = body.maxPages || 50; // safety cap (~50k hotels per run)

  const { data: run } = await supabase
    .from("hotelbeds_sync_runs")
    .insert({ status: "running", triggered_by: triggeredBy })
    .select("id")
    .single();

  let processed = 0;
  let upserted = 0;
  let pages = 0;
  let from = body.from || 1;

  try {
    while (pages < maxPages) {
      const to = from + pageSize - 1;
      const data = await fetchPage(from, to, lang);
      const hotels: any[] = data?.hotels || [];
      if (!hotels.length) break;

      const rows = hotels.map(mapHotel);
      const { error: upErr, count } = await supabase
        .from("hotelbeds_hotels")
        .upsert(rows, { onConflict: "code", count: "exact" });
      if (upErr) throw upErr;

      processed += hotels.length;
      upserted += count ?? hotels.length;
      pages += 1;

      const total = data?.total ?? 0;
      if (to >= total) break;
      from = to + 1;
    }

    await supabase
      .from("hotelbeds_sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        hotels_processed: processed,
        hotels_upserted: upserted,
        pages_fetched: pages,
      })
      .eq("id", run!.id);

    return new Response(
      JSON.stringify({ ok: true, processed, upserted, pages }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("hotelbeds_sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        hotels_processed: processed,
        hotels_upserted: upserted,
        pages_fetched: pages,
        error: msg,
      })
      .eq("id", run!.id);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});