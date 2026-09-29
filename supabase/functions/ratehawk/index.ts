// RateHawk / ETG hotel search — second, agent-selectable hotel supplier
// alongside Hotelbeds (not merged). Action-router shape mirrors functions/hotelbeds.
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit, getClientIP } from "../_shared/rate-limiter.ts";
import { RATEHAWK_ENV, ratehawkPost } from "../_shared/ratehawk-auth.ts";
import { handleBookingAction, sweepProcessingOrders } from "./booking.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ETG requires SERP results to be fresh — stale search prices fail certification.
// Keep this MUCH shorter than Hotelbeds' 1800s. NOTE: hotelpage/prebook responses
// (later phase) must NEVER be cached at all.
const SEARCH_CACHE_TTL_SECONDS = parseInt(
  Deno.env.get("RATEHAWK_SEARCH_CACHE_TTL_SECONDS") || "300",
  10,
);
const DAILY_SEARCH_CAP = parseInt(Deno.env.get("RATEHAWK_DAILY_SEARCH_CAP") || "45", 10);
const SEARCH_RATE_LIMIT_PER_MIN = parseInt(
  Deno.env.get("RATEHAWK_SEARCH_RATE_LIMIT_PER_MIN") || "6",
  10,
);

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function searchCacheKey(path: string, body: unknown): Promise<string> {
  const canonical = (v: any): any => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object") {
      return Object.keys(v).sort().reduce((acc: any, k) => {
        if (v[k] !== undefined && v[k] !== null) acc[k] = canonical(v[k]);
        return acc;
      }, {});
    }
    return v;
  };
  const raw = `${RATEHAWK_ENV}|${path}|${JSON.stringify(canonical(body))}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Per ETG guidance, SERP shows only the LOWEST rate per hotel. Specific-rate
// validation happens later via hotelpage/prebook (not in this phase).
function rateAmount(rate: any): number {
  const pt = rate?.payment_options?.payment_types?.[0];
  const n = parseFloat(pt?.show_amount ?? pt?.amount ?? "");
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}
function lowestRateOnly(data: any) {
  const hotels = data?.hotels;
  if (!Array.isArray(hotels)) return data;
  for (const h of hotels) {
    if (Array.isArray(h?.rates) && h.rates.length > 1) {
      const best = h.rates.reduce((a: any, b: any) => (rateAmount(b) < rateAmount(a) ? b : a));
      h.rates = [best];
    }
  }
  return data;
}

function baseSearchBody(p: any) {
  const body: any = {
    checkin: p.checkin,
    checkout: p.checkout,
    currency: p.currency || "USD",
    guests: Array.isArray(p.guests) && p.guests.length ? p.guests : [{ adults: 2, children: [] }],
    residency: p.residency || "us",
    language: p.language || "en",
  };
  if (p.filter) body.filter = p.filter;
  if (p.timeout) body.timeout = p.timeout;
  if (!body.checkin || !body.checkout) throw new Error("[400] checkin and checkout are required");
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Scheduled safety net (pg_cron): re-check orders stuck in "processing".
  const cronToken = req.headers.get("x-cron-token");
  if (cronToken) {
    const admin = adminClient();
    const { data: ok } = await admin.rpc("verify_cron_token", { p_name: "ratehawk_status_sweep", p_token: cronToken });
    if (ok !== true) return json({ error: "Unauthorized" }, 401);
    try {
      const out = await sweepProcessingOrders(admin, 10);
      console.log("ratehawk status sweep", JSON.stringify(out));
      return json({ data: out, env: RATEHAWK_ENV });
    } catch (e) {
      console.error("ratehawk status sweep failed", e);
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  // Auth check — same inline Bearer-JWT pattern as functions/hotelbeds.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  try {
    const { action, ...params } = await req.json();
    let result: any;

    switch (action) {
      case "search_by_region":
      case "search_by_hotel_ids":
      case "search_by_geo": {
        const body = baseSearchBody(params);
        let path: string;
        if (action === "search_by_region") {
          path = "/api/b2b/v3/search/serp/region";
          if (params.region_id == null) throw new Error("[400] region_id is required");
          body.region_id = Number(params.region_id);
          if (params.hotels_limit) body.hotels_limit = params.hotels_limit;
        } else if (action === "search_by_hotel_ids") {
          path = "/api/b2b/v3/search/serp/hotels";
          if (Array.isArray(params.ids)) body.ids = params.ids.map(String);
          if (Array.isArray(params.hids)) body.hids = params.hids.map(Number);
          if (!body.ids?.length && !body.hids?.length) throw new Error("[400] ids or hids is required");
        } else {
          path = "/api/b2b/v3/search/serp/geo";
          if (params.latitude == null || params.longitude == null || params.radius == null) {
            throw new Error("[400] latitude, longitude and radius are required");
          }
          body.latitude = Number(params.latitude);
          body.longitude = Number(params.longitude);
          body.radius = Number(params.radius);
          if (params.hotels_limit) body.hotels_limit = params.hotels_limit;
        }

        // 1) Cache
        const admin = adminClient();
        const cacheKey = await searchCacheKey(path, body);
        const nowIso = new Date().toISOString();
        const { data: cached } = await admin
          .from("ratehawk_search_cache")
          .select("payload")
          .eq("cache_key", cacheKey)
          .gt("expires_at", nowIso)
          .maybeSingle();
        if (cached?.payload) {
          result = { ...(cached.payload as any), cached: true };
          break;
        }

        // 2) Per-IP throttle
        const ip = getClientIP(req);
        const limited = checkRateLimit(`rh-search:${ip}`, SEARCH_RATE_LIMIT_PER_MIN, 60);
        if (limited) {
          return json({
            fallback: true,
            error: `Too many searches — please wait ${limited.retryAfter}s and try again.`,
            code: "RATEHAWK_RATE_LIMITED",
          });
        }

        // 3) Daily quota
        const { data: usage, error: usageError } = await admin.rpc(
          "ratehawk_increment_search_usage",
          { _cap: DAILY_SEARCH_CAP },
        );
        if (usageError) {
          console.error("RateHawk usage counter failed", usageError);
        } else if (usage === -1) {
          return json({
            fallback: true,
            error: "Hotel search is temporarily unavailable — daily supplier limit reached. Please try again tomorrow.",
            code: "RATEHAWK_QUOTA_EXCEEDED",
          });
        }

        // 4) Upstream
        const resp = await ratehawkPost(path, body);
        result = lowestRateOnly(resp?.data ?? { hotels: [], total_hotels: 0 });

        // 5) Short-TTL cache (SERP only) + purge expired
        const expiresAt = new Date(Date.now() + SEARCH_CACHE_TTL_SECONDS * 1000).toISOString();
        const { error: cacheError } = await admin
          .from("ratehawk_search_cache")
          .upsert({ cache_key: cacheKey, payload: result, expires_at: expiresAt }, { onConflict: "cache_key" });
        if (cacheError) console.error("RateHawk cache write failed", cacheError);
        await admin.from("ratehawk_search_cache").delete().lt("expires_at", nowIso);
        break;
      }

      case "get_cached_hotels": {
        const ids: string[] = (params.ids || []).map((i: any) => String(i));
        const hids: number[] = (params.hids || []).map((i: any) => Number(i)).filter((n: number) => Number.isFinite(n));
        const admin = adminClient();
        let query = admin
          .from("ratehawk_hotels")
          .select("id, hid, name, address, region_name, country_code, star_rating, latitude, longitude, amenity_groups, images_ext, room_groups, check_in_time, check_out_time, phone, email");
        if (hids.length) query = query.in("hid", hids);
        else if (ids.length) query = query.in("id", ids);
        const { data, error } = await query;
        if (error) throw new Error(`Cache lookup failed: ${error.message}`);
        result = { hotels: data ?? [] };
        break;
      }

      default: {
        const admin = adminClient();
        const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
        result = await handleBookingAction(action, params, {
          admin, userId: user.id, isAdmin: isAdmin === true, clientIp: getClientIP(req),
        });
        if (result === undefined) return json({ error: `Unknown action: ${action}` }, 400);
      }
    }

    return json({ data: result, env: RATEHAWK_ENV });
  } catch (error: unknown) {
    console.error("RateHawk function error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    const isBadRequest = /^\[400\]/.test(msg);
    const isUpstream = !isBadRequest && /\[(4\d\d|5\d\d)\]/.test(msg);
    return json({
      error: msg,
      code: isUpstream ? "RATEHAWK_UPSTREAM_ERROR" : (isBadRequest ? "RATEHAWK_BAD_REQUEST" : "RATEHAWK_ERROR"),
      fallback: isUpstream,
      data: null,
    }, isUpstream ? 200 : isBadRequest ? 400 : 500);
  }
});
