// supabase/functions/cruisefeed-cruise/index.ts
// CruiseFeed-backed cruise search for the agent dashboard /cruises page.
// Replaces the retired Widgety pipeline (widgety-cruise / widgety-price-sync).
//
// Secrets: CRUISEFEED_API_KEY
// Auth: requires a valid Supabase user JWT (dashboard is agent-only).
// Billing: CruiseFeed charges per RESULT returned, so per-query limits are
// conservative and every response is cached in cruisefeed_search_cache.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

const CRUISEFEED_BASE = "https://api.cruisefeed.io/v1";
// Trial key has a 300-result lifetime grant — keep per-query limits tight.
const PER_QUERY_LIMIT = 10;
const SEARCH_TTL_HOURS = 24;
const SHIPS_TTL_DAYS = 7;

// Same line universe as triton-cruise-search (verified against
// GET /v1/cruise-lines — names match CruiseFeed exactly).
const CTS_LINES: { name: string; adult_only: boolean }[] = [
  { name: "Royal Caribbean", adult_only: false },
  { name: "Carnival Cruise Line", adult_only: false },
  { name: "Norwegian Cruise Line", adult_only: false },
  { name: "Disney Cruise Line", adult_only: false },
  { name: "MSC Cruises", adult_only: false },
  { name: "Princess Cruises", adult_only: false },
  { name: "Celebrity Cruises", adult_only: false },
  { name: "Holland America Line", adult_only: false },
  { name: "Virgin Voyages", adult_only: true },
  { name: "Explora Journeys", adult_only: true },
];

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// CruiseFeed MCP (streamable HTTP, JSON-RPC 2.0). One session per invocation.
const CRUISEFEED_MCP = "https://mcp.cruisefeed.io/mcp";
let mcpSession: string | null = null;
let rpcId = 0;

async function mcpPost(payload: unknown) {
  const key = Deno.env.get("CRUISEFEED_API_KEY");
  if (!key) throw new Error("CRUISEFEED_API_KEY missing");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (mcpSession) headers["Mcp-Session-Id"] = mcpSession;
  const res = await fetch(CRUISEFEED_MCP, { method: "POST", headers, body: JSON.stringify(payload) });
  const sid = res.headers.get("mcp-session-id");
  if (sid) mcpSession = sid;
  const text = await res.text();
  if (!res.ok) throw new Error(`cruisefeed mcp ${res.status}: ${text}`);
  if (!text) return null;
  const dataLines = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim());
  const raw = dataLines.length ? dataLines[dataLines.length - 1] : text;
  return JSON.parse(raw);
}

async function ensureMcp() {
  if (mcpSession) return;
  await mcpPost({
    jsonrpc: "2.0", id: ++rpcId, method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "cts-agent-dash", version: "1" } },
  });
  await mcpPost({ jsonrpc: "2.0", method: "notifications/initialized" });
}

async function mcpTool(name: string, args: Record<string, unknown>) {
  await ensureMcp();
  const r = await mcpPost({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } });
  if (r?.error) throw new Error(`cruisefeed ${name}: ${JSON.stringify(r.error)}`);
  const txt = r?.result?.content?.find((c: any) => c.type === "text")?.text ?? "";
  if (r?.result?.isError) throw new Error(`cruisefeed ${name}: ${txt}`);
  try { return JSON.parse(txt); } catch { throw new Error(`cruisefeed ${name}: ${txt.slice(0, 300)}`); }
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Normalize a raw CruiseFeed row into the sailing shape the dashboard
// cruise-search components already consume (WidgetySailing-compatible).
function toSailing(c: any) {
  const nights = typeof c.nights === "number" ? c.nights : 0;
  const dep = typeof c.departure_date === "string" ? c.departure_date.slice(0, 10) : null;
  const itinerary = Array.isArray(c.itinerary) ? c.itinerary : [];
  const lastPort = [...itinerary].reverse().find((d: any) => !d.is_sea_day && d.port);
  return {
    holiday_ref: c.sailing_id ?? c.id,
    name:
      c.name ||
      c.title ||
      `${c.ship_name ?? "Cruise"} ${nights ? `${nights}-Night` : ""}`.trim(),
    operator_title: c.cruise_line ?? "",
    holiday: c.region ?? "",
    ship_title: c.ship_name ?? undefined,
    image_url: c.image_url || c.image || undefined,
    date_from: dep ?? undefined,
    date_to: dep && nights ? addDays(dep, nights) : undefined,
    nights,
    starts_at: c.embark_port ? { name: c.embark_port } : undefined,
    ends_at: c.disembark_port
      ? { name: c.disembark_port }
      : lastPort?.port
        ? { name: lastPort.port }
        : c.embark_port
          ? { name: c.embark_port }
          : undefined,
    description: c.description ?? null,
    // CruiseFeed extras consumed by the dashboard UI
    price_amount: typeof c.price_amount === "number" ? c.price_amount : null,
    price_currency: c.price_currency ?? "USD",
    booking_url: c.booking_url ?? c.detail_url ?? null,
    detail_url: c.detail_url ?? null,
    taxes_and_fees: typeof c.taxes_and_fees === "number" ? c.taxes_and_fees : null,
    obc_amount: typeof c.obc_amount === "number" ? c.obc_amount : null,
    sold_out: !!c.sold_out,
    fares: (Array.isArray(c.fares) ? c.fares : []).map((f: any) => ({
      cabin_class: f.cabin_class ?? f.cabin_category ?? "Cabin",
      cabin_category: f.cabin_category ?? null,
      price_amount: typeof f.price_amount === "number" ? f.price_amount : null,
      price_currency: f.price_currency ?? c.price_currency ?? "USD",
      available: f.available !== false,
    })),
    itinerary: itinerary.map((d: any, i: number) => ({
      day_number: d.day_number ?? i + 1,
      title: d.is_sea_day ? "At Sea" : d.port || "—",
      date: d.date ?? null,
      arrive: d.arrive ?? null,
      depart: d.depart ?? null,
      location: d.is_sea_day ? null : d.port || null,
      description: d.description ?? null,
    })),
  };
}

async function readCache(key: string, ttlMs: number) {
  const { data } = await supabaseAdmin()
    .from("cruisefeed_search_cache")
    .select("payload, created_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  const age = Date.now() - new Date(data.created_at).getTime();
  return age <= ttlMs ? data.payload : null;
}

async function writeCache(key: string, payload: unknown, count: number) {
  await supabaseAdmin()
    .from("cruisefeed_search_cache")
    .upsert(
      { cache_key: key, payload: payload as any, result_count: count },
      { onConflict: "cache_key" },
    );
  // Opportunistic cleanup of stale rows
  await supabaseAdmin()
    .from("cruisefeed_search_cache")
    .delete()
    .lt("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());
}

async function handleSearch(body: any) {
  const lineName = typeof body.cruise_line === "string" && body.cruise_line !== "all"
    ? body.cruise_line
    : null;
  if (lineName && !CTS_LINES.some((l) => l.name === lineName)) {
    throw new Error(`Unsupported cruise line: ${lineName}`);
  }
  const lines = lineName ? [lineName] : CTS_LINES.map((l) => l.name);

  const region = typeof body.region === "string" && body.region !== "all" ? body.region : null;
  const port = typeof body.port === "string" && body.port !== "all" ? body.port : null;

  // Default window: tomorrow → +3 years (mirrors the old page behavior).
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const end = new Date();
  end.setFullYear(end.getFullYear() + 3);
  const dateFrom = typeof body.date_from === "string" && body.date_from
    ? (body.date_from < tomorrow ? tomorrow : body.date_from)
    : tomorrow;
  const dateTo = typeof body.date_to === "string" && body.date_to
    ? body.date_to
    : end.toISOString().slice(0, 10);

  const nightsMin = typeof body.nights_min === "number" ? body.nights_min : null;
  const nightsMax = typeof body.nights_max === "number" ? body.nights_max : null;

  const cacheKey = JSON.stringify({
    k: "search", lines, region, port, dateFrom, dateTo, nightsMin, nightsMax, v: 3,
  });
  const cached = await readCache(cacheKey, SEARCH_TTL_HOURS * 3600 * 1000);
  if (cached) return { ...cached, cached: true };

  const base: Record<string, unknown> = {
    limit: PER_QUERY_LIMIT,
    sort: "price",
    departure_from: dateFrom,
    departure_to: dateTo,
  };
  if (nightsMin != null) base.min_nights = nightsMin;
  if (nightsMax != null) base.max_nights = nightsMax;

  const jobs: Record<string, unknown>[] = [];
  for (const line of lines) {
    jobs.push({ ...base, cruise_line: line, ...(region ? { region } : {}) });
  }

  await ensureMcp();
  const settled = await Promise.allSettled(jobs.map((p) => mcpTool("search_cruises", p)));
  const failures = settled.filter((s) => s.status === "rejected") as PromiseRejectedResult[];
  if (failures.length === settled.length) throw failures[0].reason;

  const seen = new Set<string>();
  let sailings: any[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") {
      console.error("cruisefeed query failed:", s.reason);
      continue;
    }
    for (const c of s.value?.items ?? []) {
      const key = c.sailing_id ?? c.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      sailings.push(toSailing(c));
    }
  }

  // Deterministic post-filters the API may not support natively.
  if (port) {
    sailings = sailings.filter((s) =>
      (s.starts_at?.name || "").toLowerCase().includes(port.toLowerCase()),
    );
  }

  const payload = { sailings, total: sailings.length };
  await writeCache(cacheKey, payload, sailings.length);
  return { ...payload, cached: false };
}

async function handleShips(cruiseLine: string) {
  if (!CTS_LINES.some((l) => l.name === cruiseLine)) {
    return { ships: [] };
  }
  const cacheKey = JSON.stringify({ k: "ships", line: cruiseLine, v: 1 });
  const cached = await readCache(cacheKey, SHIPS_TTL_DAYS * 24 * 3600 * 1000);
  if (cached) return { ships: cached, cached: true };

  try {
    // /v1/ships valid params: flag_state, limit, offset, operator, q
    const data = await mcpTool("search_ships", { operator: cruiseLine, limit: 200 });
    const raw = data?.items ?? data?.ships ?? (Array.isArray(data) ? data : []);
    const ships = raw
      .map((s: any) => ({ title: s.name || s.title || s.ship_name || "", slug: s.name || s.title || s.ship_name || "" }))
      .filter((s: any) => s.title);
    const unique = Array.from(new Map(ships.map((s: any) => [s.slug, s])).values());
    await writeCache(cacheKey, unique, unique.length);
    return { ships: unique, cached: false };
  } catch (err) {
    console.error("ships lookup failed:", err);
    return { ships: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require an authenticated dashboard user.
  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  mcpSession = null;
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "search";

    let data: unknown;
    if (action === "search") {
      data = await handleSearch(body);
    } else if (action === "ships") {
      data = await handleShips(String(body.cruise_line || ""));
    } else if (action === "lines") {
      data = { lines: CTS_LINES };
    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    return new Response(JSON.stringify(data), { headers: JSON_HEADERS });
  } catch (err) {
    console.error("cruisefeed-cruise error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: JSON_HEADERS },
    );
  }
});
