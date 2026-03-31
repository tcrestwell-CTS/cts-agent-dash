import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WIDGETY_BASE = "https://www.widgety.co.uk/api";
const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };
const WIDGETY_PAGE_SIZE = 100;
const CURRENT_YEAR = new Date().getUTCFullYear();

type WidgetyHoliday = {
  holiday_ref: string;
  operator?: string;
  operator_title?: string;
  image_url?: string | null;
  date_from?: string;
  date_to?: string;
  [key: string]: unknown;
};

const createValidatedUtcDate = (year: number, month: number, day: number) => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const isWithinAllowedWindow = (date: Date, searchDateFrom?: string, searchDateTo?: string) => {
  if (!searchDateFrom && !searchDateTo) {
    return date.getUTCFullYear() >= CURRENT_YEAR - 1 && date.getUTCFullYear() <= CURRENT_YEAR + 10;
  }

  const lowerBound = searchDateFrom
    ? new Date(`${searchDateFrom}T00:00:00.000Z`)
    : new Date(Date.UTC(date.getUTCFullYear() - 1, 0, 1));
  const upperBound = searchDateTo
    ? new Date(`${searchDateTo}T23:59:59.999Z`)
    : new Date(Date.UTC(date.getUTCFullYear() + 1, 11, 31, 23, 59, 59, 999));

  lowerBound.setUTCFullYear(lowerBound.getUTCFullYear() - 1);
  upperBound.setUTCFullYear(upperBound.getUTCFullYear() + 1);

  return date >= lowerBound && date <= upperBound;
};

const extractDepartureDateFromHolidayRef = (
  holidayRef: string,
  searchDateFrom?: string,
  searchDateTo?: string,
) => {
  const normalizedRef = holidayRef.replace(/HOL$/i, "");

  const eightDigitMatches = Array.from(normalizedRef.matchAll(/(\d{8})/g), (match) => match[1]).reverse();
  for (const candidate of eightDigitMatches) {
    const dayMonthYear = createValidatedUtcDate(
      Number(candidate.slice(4, 8)),
      Number(candidate.slice(2, 4)),
      Number(candidate.slice(0, 2)),
    );
    if (dayMonthYear && isWithinAllowedWindow(dayMonthYear, searchDateFrom, searchDateTo)) {
      return dayMonthYear.toISOString();
    }

    const yearMonthDay = createValidatedUtcDate(
      Number(candidate.slice(0, 4)),
      Number(candidate.slice(4, 6)),
      Number(candidate.slice(6, 8)),
    );
    if (yearMonthDay && isWithinAllowedWindow(yearMonthDay, searchDateFrom, searchDateTo)) {
      return yearMonthDay.toISOString();
    }
  }

  const sixDigitMatches = Array.from(normalizedRef.matchAll(/(\d{6})/g), (match) => match[1]).reverse();
  for (const candidate of sixDigitMatches) {
    const parsed = createValidatedUtcDate(
      2000 + Number(candidate.slice(0, 2)),
      Number(candidate.slice(2, 4)),
      Number(candidate.slice(4, 6)),
    );
    if (parsed && isWithinAllowedWindow(parsed, searchDateFrom, searchDateTo)) {
      return parsed.toISOString();
    }
  }

  return null;
};

const enrichHolidaysWithOperatorImages = (holidays: WidgetyHoliday[], operatorImages: Record<string, string>) => {
  for (const holiday of holidays) {
    const opMatch = typeof holiday.operator === "string"
      ? holiday.operator.match(/operators\/([^.]+)\.json/)
      : null;
    const opSlug = opMatch?.[1];
    holiday.image_url = (opSlug && operatorImages[opSlug]) || operatorImages[String(holiday.operator_title || "")] || null;
  }
};

const fetchAllHolidayPages = async (
  path: string,
  baseParams: URLSearchParams,
  fetchAll: boolean,
  requestInit?: RequestInit,
) => {
  const firstPageParams = new URLSearchParams(baseParams);
  firstPageParams.set("page", "1");
  const firstPageUrl = `${WIDGETY_BASE}/${path}?${firstPageParams.toString()}`;
  const firstResp = await fetch(firstPageUrl, requestInit);

  if (!firstResp.ok) {
    const text = await firstResp.text();
    throw new Error(`Widgety API error: ${firstResp.status} - ${text}`);
  }

  const firstData = await firstResp.json();
  const holidays = [...(firstData.holidays || [])];
  if (!fetchAll) {
    return firstData;
  }

  const total = Number(firstData.total || holidays.length);
  const count = Number(firstData.count || holidays.length || firstPageParams.get("limit") || 0);
  if (!count || total <= holidays.length) {
    return firstData;
  }

  const totalPages = Math.ceil(total / count);
  const remainingPages = Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => index + 2);

  for (let start = 0; start < remainingPages.length; start += 5) {
    const chunk = remainingPages.slice(start, start + 5);
    const chunkResults = await Promise.all(
      chunk.map(async (page) => {
        const pageParams = new URLSearchParams(baseParams);
        pageParams.set("page", String(page));
        const url = `${WIDGETY_BASE}/${path}?${pageParams.toString()}`;
        const resp = await fetch(url, requestInit);
        if (!resp.ok) {
          const text = await resp.text();
          console.error(`Widgety pagination error (${path}) page ${page}:`, resp.status, text);
          return { holidays: [] };
        }
        return await resp.json();
      }),
    );

    for (const pageResult of chunkResults) {
      holidays.push(...(pageResult.holidays || []));
    }
  }

  return {
    ...firstData,
    holidays,
  };
};

const resolveHolidayDepartureDates = async (
  holidays: WidgetyHoliday[],
  appId: string,
  token: string,
  market: string,
  searchDateFrom?: string,
  searchDateTo?: string,
) => {
  const unresolved: WidgetyHoliday[] = [];

  for (const holiday of holidays) {
    const inferredDate = extractDepartureDateFromHolidayRef(
      holiday.holiday_ref,
      searchDateFrom,
      searchDateTo,
    );

    if (inferredDate) {
      holiday.date_from = holiday.date_from || inferredDate;
      continue;
    }

    unresolved.push(holiday);
  }

  for (let start = 0; start < unresolved.length; start += 10) {
    const chunk = unresolved.slice(start, start + 10);
    await Promise.all(
      chunk.map(async (holiday) => {
        const detailParams = new URLSearchParams({
          app_id: appId,
          token,
          market,
        });
        if (searchDateFrom) detailParams.set("date_from", searchDateFrom);
        if (searchDateTo) detailParams.set("date_to", searchDateTo);

        let resp = await fetch(
          `${WIDGETY_BASE}/holidays/${encodeURIComponent(holiday.holiday_ref)}.json?${detailParams.toString()}`,
          { headers: { Accept: "application/json; api_version=2" } },
        );

        if (resp.status === 400 && (searchDateFrom || searchDateTo)) {
          const fallbackParams = new URLSearchParams({
            app_id: appId,
            token,
            market,
          });
          resp = await fetch(
            `${WIDGETY_BASE}/holidays/${encodeURIComponent(holiday.holiday_ref)}.json?${fallbackParams.toString()}`,
            { headers: { Accept: "application/json; api_version=2" } },
          );
        }

        if (!resp.ok) {
          const text = await resp.text();
          console.error("Widgety holiday detail date enrichment failed:", holiday.holiday_ref, resp.status, text);
          return;
        }

        const detail = await resp.json();
        const allDates = (detail.operating_seasons || [])
          .flatMap((season: any) => season.dates || [])
          .filter((date: any) => typeof date.date_from === "string")
          .sort((a: any, b: any) => String(a.date_from).localeCompare(String(b.date_from)));

        const matchedDate = allDates[0];
        if (!matchedDate) return;

        holiday.date_from = matchedDate.date_from;
        if (matchedDate.date_to) {
          holiday.date_to = matchedDate.date_to;
        }
      }),
    );
  }
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WIDGETY_APP_ID = Deno.env.get("WIDGETY_APP_ID");
    const WIDGETY_TOKEN = Deno.env.get("WIDGETY_TOKEN");
    if (!WIDGETY_APP_ID || !WIDGETY_TOKEN) {
      throw new Error("Widgety API credentials not configured");
    }

    const { action, ...params } = await req.json();

    // Auth check (skip for operators listing which is read-only metadata)
    if (action !== "operators") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: JSON_HEADERS,
        });
      }
    }

    if (action === "search") {
      const market = params.market || "us";
      const pageSize = Math.min(Number(params.limit) || 25, WIDGETY_PAGE_SIZE);
      const fetchAll = Boolean(params.fetch_all) && Boolean(params.date_from || params.date_to);
      const resolveDepartureDates = Boolean(params.resolve_departure_dates) && Boolean(params.date_from || params.date_to);

      // Search cruises by operator, dates, market
      const searchParams = new URLSearchParams({
        app_id: WIDGETY_APP_ID,
        token: WIDGETY_TOKEN,
        market,
      });
      if (params.operators) searchParams.set("operators", params.operators);
      if (params.date_from) searchParams.set("date_from", params.date_from);
      if (params.date_to) searchParams.set("date_to", params.date_to);
      if (params.locations) searchParams.set("locations", params.locations);
      if (params.regions) searchParams.set("regions", params.regions);
      searchParams.set("limit", String(pageSize));

      // Fetch operators for images (in parallel with search)
      const operatorsParams = new URLSearchParams({
        app_id: WIDGETY_APP_ID,
        token: WIDGETY_TOKEN,
      });
      const operatorsUrl = `${WIDGETY_BASE}/operators.json?${operatorsParams.toString()}`;

      // Try V3 Holidays API
      const url = `${WIDGETY_BASE}/holidays.json?${searchParams.toString()}`;
      console.log("Widgety search URL:", url.replace(WIDGETY_TOKEN, "***"));

      const [data, opsResp] = await Promise.all([
        fetchAllHolidayPages("holidays.json", searchParams, fetchAll),
        fetch(operatorsUrl),
      ]);

      // Build operator slug -> image map
      const operatorImages: Record<string, string> = {};
      if (opsResp.ok) {
        const opsData = await opsResp.json();
        for (const op of opsData.operators || []) {
          const slug = op.id || op.slug;
          if (slug && op.cover_image_href) {
            operatorImages[slug] = op.cover_image_href;
          }
          if (op.title && op.cover_image_href) {
            operatorImages[op.title] = op.cover_image_href;
          }
        }
      } else {
        await opsResp.text(); // consume body
      }

      if (resolveDepartureDates && data.holidays?.length) {
        await resolveHolidayDepartureDates(
          data.holidays as WidgetyHoliday[],
          WIDGETY_APP_ID,
          WIDGETY_TOKEN,
          market,
          params.date_from,
          params.date_to,
        );
      }

      if (data.holidays) {
        enrichHolidaysWithOperatorImages(data.holidays as WidgetyHoliday[], operatorImages);
      }

      // If V3 returned results, use them
      if (data.total > 0) {
        return new Response(JSON.stringify(data), {
          headers: JSON_HEADERS,
        });
      }

      // If date-filtered search returned 0 results, retry without dates
      if ((params.date_from || params.date_to) && data.total === 0) {
        console.log("Date-filtered search returned 0 results, retrying without date filters");
        const noDateParams = new URLSearchParams({
          app_id: WIDGETY_APP_ID,
          token: WIDGETY_TOKEN,
          market: params.market || "us",
        });
        if (params.operators) noDateParams.set("operators", params.operators);
        if (params.locations) noDateParams.set("locations", params.locations);
        if (params.regions) noDateParams.set("regions", params.regions);
        noDateParams.set("limit", String(pageSize));

        try {
          const noDateData = await fetchAllHolidayPages("holidays.json", noDateParams, false);
          if (noDateData.holidays) {
            enrichHolidaysWithOperatorImages(noDateData.holidays as WidgetyHoliday[], operatorImages);
          }
          if (noDateData.total > 0) {
            noDateData._date_filter_removed = true;
            return new Response(JSON.stringify(noDateData), {
              headers: JSON_HEADERS,
            });
          }
        } catch (error) {
          console.error("Widgety undated fallback failed:", error);
        }
      }

      // Fallback: try V2 Cruises API (/cruises.json)
      const v2Params = new URLSearchParams({
        app_id: WIDGETY_APP_ID,
        token: WIDGETY_TOKEN,
      });
      if (params.operators) v2Params.set("operators", params.operators);
      if (params.date_from) v2Params.set("date_from", params.date_from);
      if (params.date_to) v2Params.set("date_to", params.date_to);
      v2Params.set("limit", String(pageSize));

      const v2Url = `${WIDGETY_BASE}/cruises.json?${v2Params.toString()}`;
      console.log("Widgety V2 cruises URL:", v2Url.replace(WIDGETY_TOKEN, "***"));

      try {
        const v2Data = await fetchAllHolidayPages("cruises.json", v2Params, fetchAll);
        if (resolveDepartureDates && v2Data.holidays?.length) {
          await resolveHolidayDepartureDates(
            v2Data.holidays as WidgetyHoliday[],
            WIDGETY_APP_ID,
            WIDGETY_TOKEN,
            market,
            params.date_from,
            params.date_to,
          );
        }
        if (v2Data.holidays) {
          enrichHolidaysWithOperatorImages(v2Data.holidays as WidgetyHoliday[], operatorImages);
        }
        return new Response(JSON.stringify(v2Data), {
          headers: JSON_HEADERS,
        });
      } catch (error) {
        console.log("V2 cruises also failed:", error);
      }

      // V2 also failed, return the original empty V3 result
      return new Response(JSON.stringify(data), {
        headers: JSON_HEADERS,
      });
    }

    if (action === "operators") {
      // List available operators
      const searchParams = new URLSearchParams({
        app_id: WIDGETY_APP_ID,
        token: WIDGETY_TOKEN,
      });
      const url = `${WIDGETY_BASE}/operators.json?${searchParams.toString()}`;
      console.log("Widgety operators URL:", url.replace(WIDGETY_TOKEN, "***"));

      const resp = await fetch(url);
      if (!resp.ok) {
        const text = await resp.text();
        console.error("Widgety operators error:", resp.status, text);
        throw new Error(`Widgety API error: ${resp.status}`);
      }
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ships") {
      // List available ships - paginate through all pages
      const allShips: any[] = [];
      let page = 1;
      let totalPages = 1;
      const operatorFilter = params.operator || params.operators;
      
      while (page <= totalPages) {
        const searchParams = new URLSearchParams({
          app_id: WIDGETY_APP_ID,
          token: WIDGETY_TOKEN,
          page: String(page),
        });
        if (operatorFilter) searchParams.set("operator", operatorFilter);
        const url = `${WIDGETY_BASE}/ships.json?${searchParams.toString()}`;
        
        const resp = await fetch(url);
        if (!resp.ok) {
          const text = await resp.text();
          console.error("Widgety ships error:", resp.status, text);
          throw new Error(`Widgety API error: ${resp.status}`);
        }
        const data = await resp.json();
        const pageShips = (data.ships || []).map((ship: any) => ({
          id: ship.id,
          title: ship.title || ship.name || "",
          href: ship.href || ship.ship || ship._links?.self?.href || null,
        })).filter((ship: any) => ship.title && ship.href);
        allShips.push(...pageShips);
        
        // Calculate total pages from first response
        if (page === 1 && data.total && data.count) {
          totalPages = Math.ceil(data.total / data.count);
        }
        page++;
      }
      
      const uniqueShips = Array.from(
        new Map(allShips.map((ship: any) => [ship.href, ship])).values()
      );

      // Return simplified ship list sorted alphabetically
      uniqueShips.sort((a: any, b: any) => (a.title || "").localeCompare(b.title || ""));
      
      return new Response(JSON.stringify({ ships: uniqueShips, total: uniqueShips.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ports") {
      // List available ports
      const searchParams = new URLSearchParams({
        app_id: WIDGETY_APP_ID,
        token: WIDGETY_TOKEN,
        market: params.market || "us",
      });
      const url = `${WIDGETY_BASE}/ports.json?${searchParams.toString()}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const text = await resp.text();
        console.error("Widgety ports error:", resp.status, text);
        throw new Error(`Widgety API error: ${resp.status}`);
      }
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "holiday") {
      // Get holiday details (includes dates with itinerary_code)
      const holidayRef = params.holiday_ref;
      if (!holidayRef) throw new Error("holiday_ref is required");

      const searchParams = new URLSearchParams({
        app_id: WIDGETY_APP_ID,
        token: WIDGETY_TOKEN,
        market: params.market || "us",
      });
      if (params.date_from) searchParams.set("date_from", params.date_from);
      if (params.date_to) searchParams.set("date_to", params.date_to);

      const url = `${WIDGETY_BASE}/holidays/${encodeURIComponent(holidayRef)}.json?${searchParams.toString()}`;
      let resp = await fetch(url, {
        headers: { Accept: "application/json; api_version=2" },
      });

      // If date-filtered request returns 400 (no dates match), retry without date filters
      if (resp.status === 400 && (params.date_from || params.date_to)) {
        console.log("Holiday date-filtered request returned 400, retrying without date filters");
        const fallbackParams = new URLSearchParams({
          app_id: WIDGETY_APP_ID,
          token: WIDGETY_TOKEN,
          market: params.market || "us",
        });
        const fallbackUrl = `${WIDGETY_BASE}/holidays/${encodeURIComponent(holidayRef)}.json?${fallbackParams.toString()}`;
        resp = await fetch(fallbackUrl, {
          headers: { Accept: "application/json; api_version=2" },
        });
      }

      if (!resp.ok) {
        const text = await resp.text();
        console.error("Widgety holiday error:", resp.status, text);
        throw new Error(`Widgety API error: ${resp.status}`);
      }
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "itinerary") {
      // Get full date details including day-by-day itinerary
      const dateRef = params.date_ref;
      const itineraryCode = params.itinerary_code;
      if (!dateRef && !itineraryCode) throw new Error("date_ref or itinerary_code is required");

      const authParams = new URLSearchParams({
        app_id: WIDGETY_APP_ID,
        token: WIDGETY_TOKEN,
        market: params.market || "us",
      });

      let data: any = null;

      // Strategy 1: Try dedicated itinerary endpoint if itinerary_code is available
      if (itineraryCode) {
        const itinUrl = `${WIDGETY_BASE}/itineraries/${encodeURIComponent(itineraryCode)}.json?${authParams.toString()}`;
        console.log("Trying itinerary endpoint:", itinUrl.replace(WIDGETY_TOKEN, "***"));
        const itinResp = await fetch(itinUrl, {
          headers: { Accept: "application/json;api_version=2" },
        });
        if (itinResp.ok) {
          data = await itinResp.json();
          console.log("Itinerary endpoint returned days:", data.days?.length || data.itinerary?.days?.length || 0);
        } else {
          const text = await itinResp.text();
          console.log("Itinerary endpoint failed:", itinResp.status, text);
        }
      }

      // Strategy 2: Fall back to date details endpoint
      if (!data || (!data.days?.length && !data.itinerary?.days?.length)) {
        const dateUrl = `${WIDGETY_BASE}/holidays/dates/${encodeURIComponent(dateRef || itineraryCode)}.json?${authParams.toString()}`;
        console.log("Trying date details endpoint:", dateUrl.replace(WIDGETY_TOKEN, "***"));
        const dateResp = await fetch(dateUrl, {
          headers: { Accept: "application/json;api_version=2" },
        });
        if (dateResp.ok) {
          data = await dateResp.json();
          console.log("Date details returned itinerary days:", data.itinerary?.days?.length || 0);
        } else {
          const text = await dateResp.text();
          console.error("Date details endpoint failed:", dateResp.status, text);
          throw new Error(`Widgety API error: ${dateResp.status}`);
        }
      }

      // Transform the itinerary days into our format (handle both response shapes)
      const rawDays = data.days || data.itinerary?.days || [];
      const items = rawDays.map((day: any, idx: number) => {
        const location = day.locations?.[0];
        const locationName = location?.name || day.day_name || "";
        const country = location?.country || "";
        const arrivalTime = location?.arrival_time || null;
        const departureTime = location?.departure_time || null;

        // Strip HTML from programme
        const programme = (day.programme || "")
          .replace(/<[^>]*>/g, "")
          .trim();

        // Build meals string
        const meals: string[] = [];
        if (day.breakfast_included) meals.push("Breakfast");
        if (day.lunch_included) meals.push("Lunch");
        if (day.dinner_included) meals.push("Dinner");

        return {
          day_number: day.day,
          title: `${locationName}${country ? `, ${country}` : ""}`,
          description: programme || `Day ${day.day} — ${day.day_name || "At Sea"}`,
          category: "cruise",
          location: locationName,
          start_time: arrivalTime,
          end_time: departureTime,
          notes: meals.length > 0 ? `Meals: ${meals.join(", ")}` : null,
        };
      });

      return new Response(
        JSON.stringify({
          items,
          holiday_name: data.holiday_name || data.name || "",
          ship_title: data.ship_title || "",
          operator_title: data.operator_title || "",
          date_from: data.date_from,
          date_to: data.date_to,
          starts_at: data.starts_at,
          ends_at: data.ends_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("widgety-cruise error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

