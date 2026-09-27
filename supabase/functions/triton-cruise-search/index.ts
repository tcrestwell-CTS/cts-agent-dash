// supabase/functions/triton-cruise-search/index.ts
// Triton — cross-line cruise package recommendation agent
// POST { query: string, max_results?: number, force_include_adult_lines?: boolean }
// Auth: x-agent-secret header (401 without it), CORS locked to crestwellgetaways.com
// Secrets required: AGENT_SECRET, ANTHROPIC_API_KEY, CRUISEFEED_API_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://crestwellgetaways.com",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const PARSE_MODEL = "claude-haiku-4-5-20251001";
const RANK_MODEL = "claude-sonnet-4-6";

// Florida embark ports Triton knows how to expand from region keywords.
const PORT_GROUPS: Record<string, string[]> = {
  florida: ["Miami", "Port Canaveral", "Fort Lauderdale", "Tampa", "Jacksonville"],
  gulf: ["New Orleans", "Galveston", "Mobile", "Tampa"],
  southeast_drive: ["Jacksonville", "Port Canaveral", "Charleston", "New Orleans", "Mobile"],
};

// Lines CTS does business with. adult_only lines are excluded for family queries.
const CTS_LINES = [
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

interface Criteria {
  date_from: string; // ISO date, earliest embark
  date_to: string; // ISO date, latest embark
  embark_ports: string[];
  regions: string[]; // itinerary regions e.g. ["Caribbean","Bahamas"]
  nights_min: number | null;
  nights_max: number | null;
  traveler_profile: {
    adults: number | null;
    kids: boolean;
    teens: boolean;
    seniors: boolean;
    accessibility_notes: string | null;
  };
  budget_per_person_max: number | null;
  lines_preferred: string[];
  lines_excluded: string[];
  notes: string;
}

interface Candidate {
  id: string;
  line: string;
  ship: string;
  embark_date: string;
  embark_port: string;
  nights: number;
  itinerary: string[];
  price_from: number | null;
  currency: string | null;
  url: string | null;
}

// ---------- Anthropic helper ----------

async function claude(
  model: string,
  system: string,
  user: string,
  maxTokens = 2048,
): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");
}

function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf(cleaned.startsWith("[") ? "[" : "{");
  return JSON.parse(cleaned.slice(start)) as T;
}

// ---------- Stage 1: parse ----------

const PARSE_SYSTEM = `You convert a travel advisor's natural-language cruise request into strict JSON search criteria. Today's date is {{TODAY}}.

Rules:
- Respond with ONLY a JSON object. No prose, no markdown fences.
- Date phrases resolve to an embark-date window. "Week of Christmas" means embark dates from Dec 19 through Dec 27 of the nearest upcoming Christmas unless a year is given. "Spring break" means mid-March through mid-April. Always return concrete ISO dates.
- Departure-area keywords expand to embark_ports: "Florida" -> ["Miami","Port Canaveral","Fort Lauderdale","Tampa","Jacksonville"]. "Gulf" -> ["New Orleans","Galveston","Mobile","Tampa"]. A named port stays as-is. These describe where the ship leaves FROM, not where it sails to.
- Itinerary regions go in regions[] (NOT embark_ports). Recognized region vocabulary: Caribbean, Mediterranean, Alaska, Bahamas, Bermuda, Hawaii, Europe, Northern Europe, Southern Europe, Scandinavia, Asia, Pacific, South America, North America, Central America, Americas, Middle East, Indian Ocean, Mississippi, Amazon, Atlantic. Always extract these into regions[] when mentioned — never leave them only in notes. Example: "Caribbean cruise from Florida" -> regions:["Caribbean"], embark_ports:["Miami","Port Canaveral","Fort Lauderdale","Tampa","Jacksonville"].
- If kids or teens are mentioned, set traveler_profile.kids/teens true and add "Virgin Voyages" and "Explora Journeys" to lines_excluded (adults-only / adult-oriented).
- nights_min/nights_max: null unless stated or clearly implied ("long weekend" -> 3-4, "week-long" -> 6-8).
- budget_per_person_max: null unless a number is given.
- notes: anything that matters for ranking but has no structured field (e.g. "first cruise", "multigenerational", "prefers newer ships").

JSON shape:
{"date_from":"","date_to":"","embark_ports":[],"regions":[],"nights_min":null,"nights_max":null,"traveler_profile":{"adults":null,"kids":false,"teens":false,"seniors":false,"accessibility_notes":null},"budget_per_person_max":null,"lines_preferred":[],"lines_excluded":[],"notes":""}`;

async function parseQuery(query: string): Promise<Criteria> {
  const today = new Date().toISOString().slice(0, 10);
  const raw = await claude(
    PARSE_MODEL,
    PARSE_SYSTEM.replace("{{TODAY}}", today),
    query,
    1024,
  );
  return extractJson<Criteria>(raw);
}

// Deterministic fallback: if the parser leaves regions[] empty, scan the raw
// query text against the same REGION_MAP vocabulary used downstream. Prevents
// a CruiseFeed search with no region filter (which typically returns zero
// candidates once port + date filters are also applied).
function inferRegionsFromQuery(query: string): string[] {
  const q = query.toLowerCase();
  const hits = new Set<string>();
  for (const keyword of Object.keys(REGION_MAP)) {
    if (q.includes(keyword)) hits.add(keyword);
  }
  return Array.from(hits);
}

// ---------- Stage 2: retrieve (CruiseFeed) ----------
// CruiseFeed REST API (https://api.cruisefeed.io, OpenAPI v1.14.0).
// Auth: `Authorization: Bearer <CRUISEFEED_API_KEY>` (per their llms.txt/OpenAPI).
// GET /v1/cruises returns full CruiseOut rows (itinerary, fares, price_amount,
// price_currency, booking_url, detail_url), so no per-sailing detail call
// (/v1/cruises/{id}) is needed for ranking.
// Billing is per RESULT returned, so each per-line request is capped.
// cruise_line names in CruiseFeed match CTS_LINES names exactly (verified
// against GET /v1/cruise-lines).

const CRUISEFEED_BASE = "https://api.cruisefeed.io/v1";
const PER_QUERY_LIMIT = 8; // trial key has a 300-result lifetime grant
const MAX_CANDIDATES = 150;

// Region vocabulary (lowercase) -> CruiseFeed region filter value (substring
// match, canonicalized server-side). Also used by inferRegionsFromQuery.
const REGION_MAP: Record<string, string> = {
  caribbean: "Caribbean", mediterranean: "Mediterranean", alaska: "Alaska",
  bahamas: "Bahamas", bermuda: "Bermuda", hawaii: "Hawaii", europe: "Europe",
  "northern europe": "Northern Europe", "southern europe": "Mediterranean",
  scandinavia: "Scandinavia", asia: "Asia", pacific: "Pacific",
  "south america": "South America", "north america": "North America",
  "central america": "Central America", americas: "America",
  "middle east": "Middle East", "indian ocean": "Indian Ocean",
  mississippi: "Mississippi", amazon: "Amazon", atlantic: "Atlantic",
};

async function cruiseFeedGet(path: string, params: Record<string, string>) {
  const key = Deno.env.get("CRUISEFEED_API_KEY");
  if (!key) throw new Error("CRUISEFEED_API_KEY missing");
  const res = await fetch(`${CRUISEFEED_BASE}${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`cruisefeed ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function searchCruiseFeed(criteria: Criteria): Promise<Candidate[]> {
  const allowedLines = CTS_LINES
    .filter((l) => !criteria.lines_excluded.includes(l.name))
    .filter((l) =>
      criteria.lines_preferred.length === 0 ||
      criteria.lines_preferred.includes(l.name)
    )
    .map((l) => l.name);
  if (allowedLines.length === 0) return [];

  const base: Record<string, string> = {
    limit: String(PER_QUERY_LIMIT),
    dedupe: "true",
    currency: "USD",
    sort: "price",
  };
  if (criteria.date_from) base.departure_from = criteria.date_from;
  if (criteria.date_to) base.departure_to = criteria.date_to;
  if (criteria.nights_min != null) base.min_nights = String(criteria.nights_min);
  if (criteria.nights_max != null) base.max_nights = String(criteria.nights_max);
  if (criteria.budget_per_person_max != null) base.max_price = String(criteria.budget_per_person_max);

  const regions = Array.from(new Set(
    (criteria.regions ?? []).map((r) => REGION_MAP[r.toLowerCase()] ?? r).filter(Boolean),
  ));
  const regionList: (string | null)[] = regions.length ? regions : [null];

  const jobs: Record<string, string>[] = [];
  for (const line of allowedLines) {
    for (const region of regionList) {
      jobs.push({ ...base, cruise_line: line, ...(region ? { region } : {}) });
    }
  }

  const settled = await Promise.allSettled(jobs.map((p) => cruiseFeedGet("/cruises", p)));
  const failures = settled.filter((s) => s.status === "rejected") as PromiseRejectedResult[];
  if (failures.length === settled.length) throw failures[0].reason;
  failures.forEach((f) => console.error("cruisefeed query failed:", f.reason));

  const seen = new Set<string>();
  const results: Candidate[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const c of s.value?.items ?? []) {
      const key = c.sailing_id ?? c.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      results.push({
        id: c.id,
        line: c.cruise_line ?? "",
        ship: c.ship_name ?? "",
        embark_date: c.departure_date ?? "",
        embark_port: c.embark_port ?? "",
        nights: c.nights ?? 0,
        itinerary: (c.itinerary ?? [])
          .map((d: any) => (d.is_sea_day ? "At Sea" : d.port))
          .filter(Boolean),
        price_from: typeof c.price_amount === "number" ? c.price_amount : null,
        currency: c.price_currency ?? null,
        url: c.booking_url ?? c.detail_url ?? null,
      });
    }
  }

  // Deterministic post-filter (belt and suspenders regardless of API filters):
  return results.filter((c) => {
    if (!allowedLines.includes(c.line)) return false;
    if (!c.embark_date) return false;
    if (c.embark_date < criteria.date_from || c.embark_date > criteria.date_to) return false;
    if (
      criteria.embark_ports.length > 0 &&
      !criteria.embark_ports.some((p) =>
        c.embark_port.toLowerCase().includes(p.toLowerCase())
      )
    ) return false;
    if (criteria.nights_min !== null && c.nights < criteria.nights_min) return false;
    if (criteria.nights_max !== null && c.nights > criteria.nights_max) return false;
    return true;
  }).slice(0, MAX_CANDIDATES);
}

// ---------- Stage 3: rank ----------

const RANK_SYSTEM = `You are Triton, Crestwell Travel Services' cruise-matching specialist. You receive an advisor's request, parsed criteria, and candidate sailings from live inventory. Score each candidate 0-100 for fit and return the best options.

Domain knowledge to apply:
- Teen/kid fit is about the SHIP, not just the line. Strong teen hardware: Royal Caribbean Oasis/Icon/Quantum class (waterslides, FlowRider, teen-only lounges), Carnival Excel/Vista class (BOLT coaster, Ultimate Playground), NCL Prima/Breakaway-Plus (go-karts, racetracks), Disney (best kids' clubs afloat, fewer teen thrills), MSC World/Seaside class (good value, kids-sail promos). Older/smaller ships in any fleet may have a kids' club on paper but weak teen appeal — score them down for teen-focused requests.
- Holiday-week sailings carry peak pricing and full ships. Note it honestly; do not hide it.
- Shorter itineraries (3-4 nights) on older hardware are usually a poor fit for teens; 7-night Caribbean on new hardware is the sweet spot.
- Sea-day-heavy vs port-heavy matters: teens generally do better with more sea days on feature-rich ships.

Honesty rules (Crestwell brand behavior — non-negotiable):
- Every recommendation includes at least one genuine caveat (pricing premium, older ship, long drive to port, crowded holiday sailing, interior-cabin pricing shown, etc.).
- Never invent amenities, prices, or itinerary details not present in the candidate data or well-established ship facts. If price_from is null, say "pricing on request" — do not guess.

Respond with ONLY a JSON array (no prose, no fences), ranked best first, max {{MAX}} items:
[{"id":"","rank":1,"score":0,"line":"","ship":"","embark_date":"","embark_port":"","nights":0,"price_from":null,"why_it_fits":"2-3 sentences, advisor-facing","caveats":"1-2 sentences, honest","client_blurb":"2-3 sentences, warm client-ready copy, no hype words"}]`;

async function rankCandidates(
  query: string,
  criteria: Criteria,
  candidates: Candidate[],
  maxResults: number,
) {
  if (candidates.length === 0) return [];
  const raw = await claude(
    RANK_MODEL,
    RANK_SYSTEM.replace("{{MAX}}", String(maxResults)),
    JSON.stringify({ advisor_request: query, criteria, candidates }),
    4096,
  );
  return extractJson<unknown[]>(raw);
}

// ---------- Run log (optional — see cruise_search_runs migration) ----------
// Service-role only, no anon/authenticated policies on that table, so this
// only ever works from inside the edge runtime with its platform-injected
// creds — never add a fallback to a lesser key here.

function getRunLogger() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

// ---------- Handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.headers.get("x-agent-secret") !== Deno.env.get("AGENT_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const started = Date.now();
  let query: string | undefined;
  let criteria: Criteria | undefined;
  let candidates: Candidate[] = [];
  let results: unknown[] = [];

  // Best-effort — a logging failure must never affect the actual response.
  // No-ops silently if cruise_search_runs hasn't been created yet.
  const logRun = async (error?: string) => {
    const supabase = getRunLogger();
    if (!supabase) return;
    try {
      await supabase.from("cruise_search_runs").insert({
        query: query ?? "",
        criteria: criteria ?? null,
        candidates_considered: candidates.length,
        results: results.length ? results : null,
        duration_ms: Date.now() - started,
        error: error ?? null,
      });
    } catch (logErr) {
      console.error("triton run-log insert failed:", logErr);
    }
  };

  try {
    const body = await req.json();
    query = body.query;
    const max_results = body.max_results ?? 5;
    if (!query || typeof query !== "string" || query.length > 2000) {
      await logRun("invalid query");
      return new Response(JSON.stringify({ error: "invalid query" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    criteria = await parseQuery(query);
    if (!criteria.regions || criteria.regions.length === 0) {
      criteria.regions = inferRegionsFromQuery(query);
    }
    candidates = await searchCruiseFeed(criteria);
    results = await rankCandidates(
      query,
      criteria,
      candidates,
      Math.min(Math.max(1, max_results), 10),
    );
    // Attach source-of-truth price/currency/url from CruiseFeed (never from the model).
    const byId = new Map(candidates.map((c) => [c.id, c]));
    results = results.map((r: any) => {
      const c = byId.get(r?.id);
      return c ? { ...r, price_from: c.price_from, currency: c.currency, url: c.url } : r;
    });

    await logRun();

    return new Response(
      JSON.stringify({
        agent: "triton",
        query,
        criteria,
        results,
        meta: {
          candidates_considered: candidates.length,
          duration_ms: Date.now() - started,
          source: "cruisefeed",
        },
      }),
      { headers: { ...CORS_HEADERS, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("triton error:", err);
    await logRun(err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "search failed" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
});
