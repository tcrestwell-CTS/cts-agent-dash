// supabase/functions/triton-cruise-search/index.ts
// Triton — cross-line cruise package recommendation agent
// POST { query: string, max_results?: number, force_include_adult_lines?: boolean }
// Auth: x-agent-secret header (401 without it), CORS locked to crestwellgetaways.com
// Secrets required: AGENT_SECRET, ANTHROPIC_API_KEY, WIDGETY_APP_TOKEN, WIDGETY_APP_ID

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
- Region keywords expand to embark_ports: "Florida" -> ["Miami","Port Canaveral","Fort Lauderdale","Tampa","Jacksonville"]. "Gulf" -> ["New Orleans","Galveston","Mobile","Tampa"]. A named port stays as-is.
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

// ---------- Stage 2: retrieve (Widgety) ----------
// Ported from crestwell-public-site's proven app/api/widgety/cruises/route.ts.
// Same base URL, same auth (app_id/token as QUERY PARAMS, not headers), same
// Accept: application/json header with NO api_version (adding api_version=2
// drops results from 27,000+ V3 holidays down to 3 V2-only operators — the
// load-bearing fix documented at the top of that route), same V2-only-operator
// fallback, same region slug map, same two-step search -> per-holiday detail
// enrichment pagination (list endpoint returns bare holiday_refs; nights/
// dates/ship come from a second per-holiday fetch, batched 18 at a time).
//
// Known gap: the proven route has no verified embark-port filter param (its
// POST handler accepts a `locations` param but no confirmed value format was
// ever exercised) — not inventing one. Port filtering is left entirely to
// this file's existing deterministic post-filter below, which already
// handles it via embark_port substring match.
//
// Known gap: the proven route does not extract a price field anywhere (not
// in V3 list, V2, or per-holiday detail responses) — price_from stays null,
// matching the rest of this file's "pricing on request" handling.

const WIDGETY_BASE = "https://www.widgety.co.uk/api";
const WIDGETY_HEADERS = { Accept: "application/json" };
const WIDGETY_V2_HEADERS = { Accept: "application/json;api_version=2" };

// These operators only have inventory in V2 /cruises.json, not V3 /holidays.json.
const V2_ONLY_OPERATORS = new Set([
  "american-cruise-lines",
  "cunard-line",
  "princess-cruises",
]);

// CTS_LINES display name -> Widgety operator slug. Slugs are copied verbatim
// from the proven route's ACTIVE_OPERATORS list (verified against the live
// API); the name<->slug pairing itself is new but low-risk — it only
// associates already-proven slugs with names already hardcoded in this file.
const LINE_TO_OPERATOR: Record<string, string> = {
  "Royal Caribbean": "royal-caribbean-international",
  "Carnival Cruise Line": "carnival-cruise-lines-operator",
  "Norwegian Cruise Line": "norwegian-cruise-line",
  "Disney Cruise Line": "disney-cruise-line",
  "MSC Cruises": "msc-cruises",
  "Princess Cruises": "princess-cruises",
  "Celebrity Cruises": "celebrity-cruises",
  "Holland America Line": "holland-america-line",
  "Virgin Voyages": "virgin-voyages",
  "Explora Journeys": "explora-journeys",
};
const OPERATOR_TO_LINE: Record<string, string> = Object.fromEntries(
  Object.entries(LINE_TO_OPERATOR).map(([name, slug]) => [slug, name]),
);

// Region keyword (lowercase) -> Widgety region slug. Copied verbatim from the
// proven route's REGION_MAP — verified valid against the live API.
const REGION_MAP: Record<string, string> = {
  caribbean: "caribbean", mediterranean: "mediterranean", alaska: "alaska",
  bahamas: "bahamas", bermuda: "bermuda", hawaii: "hawaii", europe: "europe",
  "northern europe": "northern-europe", "southern europe": "southern-europe",
  scandinavia: "scandinavia", asia: "asia", pacific: "pacific",
  "south america": "south-america", "north america": "north-america",
  "central america": "central-america", americas: "americas",
  "middle east": "middle-east", "indian ocean": "indian-ocean",
  mississippi: "mississippi", amazon: "amazon", atlantic: "atlantic",
};

const MAX_CANDIDATES = 150;

function widgetyAuth(): Record<string, string> {
  return {
    app_id: Deno.env.get("WIDGETY_APP_ID") ?? "",
    token: Deno.env.get("WIDGETY_APP_TOKEN") ?? "",
  };
}

async function searchHolidays(params: Record<string, string>) {
  try {
    const res = await fetch(
      `${WIDGETY_BASE}/holidays.json?${new URLSearchParams({ ...widgetyAuth(), market: "us", ...params })}`,
      { headers: WIDGETY_HEADERS },
    );
    if (!res.ok) return null;
    const d = await res.json();
    return { holidays: d.holidays ?? [], total: d.total ?? 0 };
  } catch {
    return null;
  }
}

async function searchCruisesV2(params: Record<string, string>) {
  try {
    const res = await fetch(
      `${WIDGETY_BASE}/cruises.json?${new URLSearchParams({ ...widgetyAuth(), ...params })}`,
      { headers: WIDGETY_V2_HEADERS },
    );
    if (!res.ok) return null;
    const d = await res.json();
    const holidays = (d.cruises ?? []).map((c: any) => ({
      holiday_ref: c.ref,
      operator: c.operator,
      operator_title: c.operator_title,
      cruise_nights: c.cruise_nights ? parseInt(c.cruise_nights) : null,
      starts_at: { name: c.starts_at },
      date_from: c.starts_on,
      ship_title: c.ship_title,
    }));
    return { holidays, total: d.total ?? 0 };
  } catch {
    return null;
  }
}

async function enrichWithDetail(h: any) {
  if (h.date_from && h.cruise_nights) return h; // V2 results already carry these
  try {
    const detRes = await fetch(
      `${WIDGETY_BASE}/holidays/${encodeURIComponent(h.holiday_ref)}.json?${new URLSearchParams({ ...widgetyAuth(), market: "us" })}`,
      { headers: WIDGETY_HEADERS },
    );
    if (!detRes.ok) return h;
    const det = await detRes.json();
    let date_from: string | null = null;
    let ship_title: string | null = null;
    for (const s of det.operating_seasons ?? []) {
      for (const d of s.dates ?? []) {
        if (d.date_from) {
          date_from = d.date_from;
          ship_title = d.ship_title ?? null;
          break;
        }
      }
      if (date_from) break;
    }
    return {
      ...h,
      cruise_nights: det.cruise_nights ?? (det.duration_days ? det.duration_days - 1 : null),
      starts_at: det.starts_at ?? h.starts_at ?? null,
      date_from,
      ship_title,
    };
  } catch {
    return h;
  }
}

async function searchWidgety(criteria: Criteria): Promise<Candidate[]> {
  const token = Deno.env.get("WIDGETY_APP_TOKEN");
  const appId = Deno.env.get("WIDGETY_APP_ID");
  if (!token || !appId) throw new Error("widgety credentials missing");

  const allowedLines = CTS_LINES
    .filter((l) => !criteria.lines_excluded.includes(l.name))
    .filter((l) =>
      criteria.lines_preferred.length === 0 ||
      criteria.lines_preferred.includes(l.name)
    )
    .map((l) => l.name);

  const operatorPool = allowedLines
    .map((name) => LINE_TO_OPERATOR[name])
    .filter((slug): slug is string => Boolean(slug));

  if (operatorPool.length === 0) return [];

  const baseParams: Record<string, string> = { limit: "25" };
  if (criteria.date_from) baseParams.date_from = criteria.date_from;
  if (criteria.date_to) baseParams.date_to = criteria.date_to;

  const mappedRegions = criteria.regions
    .map((r) => REGION_MAP[r.toLowerCase()])
    .filter((s): s is string => Boolean(s));
  if (mappedRegions.length) baseParams.regions = mappedRegions.join(",");

  const fetchOp = (op: string) =>
    V2_ONLY_OPERATORS.has(op)
      ? searchCruisesV2({ ...baseParams, operators: op })
      : searchHolidays({ ...baseParams, operators: op });

  const perOperator = await Promise.all(operatorPool.map(fetchOp));
  const rawHolidays = perOperator.flatMap((r) => r?.holidays ?? []).slice(0, MAX_CANDIDATES);

  const enriched: any[] = [];
  const BATCH = 18;
  for (let i = 0; i < rawHolidays.length; i += BATCH) {
    const batch = await Promise.all(rawHolidays.slice(i, i + BATCH).map(enrichWithDetail));
    enriched.push(...batch);
  }

  const results: Candidate[] = enriched
    .filter((h) => h.holiday_ref && h.date_from)
    .map((h) => {
      const operatorSlug = (h.operator ?? "").match(/operators\/([^.]+)\.json/)?.[1] ?? h.operator;
      return {
        id: h.holiday_ref,
        line: OPERATOR_TO_LINE[operatorSlug] ?? h.operator_title ?? "",
        ship: h.ship_title ?? "",
        embark_date: h.date_from,
        embark_port: h.starts_at?.name ?? "",
        nights: h.cruise_nights ?? 0,
        itinerary: [],
        price_from: null, // no price field exists anywhere in the Widgety integration
        currency: null,
        url: null, // no deep links to cruise-line sites — advisor CTA is the only forward path
      };
    });

  // Deterministic post-filter (belt and suspenders regardless of API filters):
  return results.filter((c) => {
    if (!allowedLines.includes(c.line)) return false;
    if (c.embark_date < criteria.date_from || c.embark_date > criteria.date_to) {
      return false;
    }
    if (
      criteria.embark_ports.length > 0 &&
      !criteria.embark_ports.some((p) =>
        c.embark_port.toLowerCase().includes(p.toLowerCase())
      )
    ) return false;
    if (criteria.nights_min !== null && c.nights < criteria.nights_min) return false;
    if (criteria.nights_max !== null && c.nights > criteria.nights_max) return false;
    return true;
  });
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
    candidates = await searchWidgety(criteria);
    results = await rankCandidates(
      query,
      criteria,
      candidates,
      Math.min(Math.max(1, max_results), 10),
    );

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
          source: "widgety",
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
