import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Toggle between test and production environments
const HB_ENV = Deno.env.get("HOTELBEDS_ENV") || "test"; // "test" or "live"

// mTLS proxy (Cloudflare Worker) — pass-through contract.
// When HOTELBEDS_MTLS_PROXY_URL is set, every HotelBeds call is sent to the
// Worker origin instead of api.hotelbeds.com. The Worker forwards the request
// (method, path, query, body, headers) unchanged and attaches the client cert
// for mTLS. Auth is done with the X-MTLS-Proxy-Token header.
const HB_PROXY_URL = (Deno.env.get("HOTELBEDS_MTLS_PROXY_URL") ?? "").replace(/\/+$/, "");
const HB_PROXY_TOKEN = Deno.env.get("HOTELBEDS_MTLS_PROXY_TOKEN") ?? "";
const USE_PROXY = HB_PROXY_URL.length > 0;

if (USE_PROXY && !HB_PROXY_TOKEN) {
  console.warn(
    "[hotelbeds] HOTELBEDS_MTLS_PROXY_URL is set but HOTELBEDS_MTLS_PROXY_TOKEN is empty — Worker will return 403.",
  );
}

const HB_DIRECT_ORIGIN =
  HB_ENV === "live" ? "https://api.hotelbeds.com" : "https://api.test.hotelbeds.com";
const HB_ORIGIN = USE_PROXY ? HB_PROXY_URL : HB_DIRECT_ORIGIN;

const HB_BASE = `${HB_ORIGIN}/hotel-api/1.0`;
const HB_CONTENT_BASE = `${HB_ORIGIN}/hotel-content-api/1.0`;

async function generateSignature(apiKey: string, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const raw = apiKey + secret + timestamp;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Optional direct mTLS (used only in live env when both cert + key are set,
// and the Worker proxy is NOT configured).
const HB_CLIENT_CERT = Deno.env.get("HOTELBEDS_CLIENT_CERT");
const HB_CLIENT_KEY = Deno.env.get("HOTELBEDS_CLIENT_KEY");
let mtlsClient: Deno.HttpClient | null = null;
if (!USE_PROXY && HB_ENV === "live" && HB_CLIENT_CERT && HB_CLIENT_KEY) {
  try {
    // @ts-ignore — createHttpClient is available in Deno Deploy runtime
    mtlsClient = Deno.createHttpClient({
      certChain: HB_CLIENT_CERT,
      privateKey: HB_CLIENT_KEY,
    });
  } catch (e) {
    console.error("Failed to create mTLS client:", e);
  }
}

// Cert 3.x — Recommended Selling Price markup (B2C resale)
const RSP_MARKUP_PCT = parseFloat(Deno.env.get("HOTELBEDS_RSP_MARKUP_PCT") || "18");

function decorateRsp(result: any) {
  const hotels = result?.hotels?.hotels;
  if (!Array.isArray(hotels)) return result;
  const factor = 1 + RSP_MARKUP_PCT / 100;
  for (const h of hotels) {
    for (const room of h?.rooms || []) {
      for (const rate of room?.rates || []) {
        const net = parseFloat(rate?.net ?? "0");
        if (net > 0) {
          rate.rsp = (net * factor).toFixed(2);
          rate.rspMarkupPct = RSP_MARKUP_PCT;
        }
      }
    }
  }
  return result;
}

async function hbFetch(basePath: string, path: string, method: string, body?: any) {
  const apiKey = Deno.env.get("HOTELBEDS_API_KEY");
  const apiSecret = Deno.env.get("HOTELBEDS_API_SECRET");
  if (!apiKey || !apiSecret) {
    throw new Error("HotelBeds API credentials not configured");
  }

  const signature = await generateSignature(apiKey, apiSecret);

  const hbHeaders: Record<string, string> = {
    "Api-key": apiKey,
    "X-Signature": signature,
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "Content-Type": "application/json",
    ...(USE_PROXY ? { "X-MTLS-Proxy-Token": HB_PROXY_TOKEN } : {}),
  };

  // Build URL against the active origin (proxy or direct). Paths are identical
  // either way; the Worker forwards /hotel-api/... and /hotel-content-api/...
  // unchanged to api.hotelbeds.com.
  const url = `${basePath}${path}`;
  const options: RequestInit = { method, headers: hbHeaders };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  if (mtlsClient && !USE_PROXY) {
    // @ts-ignore — `client` is a Deno-specific fetch option
    (options as any).client = mtlsClient;
  }

  const response = await fetch(url, options);
  const rawText = await response.text();
  let data: any = null;
  try { data = rawText ? JSON.parse(rawText) : null; } catch { /* non-JSON */ }

  if (!response.ok) {
    console.error("HotelBeds API error", {
      env: HB_ENV,
      proxied: USE_PROXY,
      proxyMtls: response.headers.get("x-proxy-mtls"),
      proxiedBy: response.headers.get("x-proxied-by"),
      status: response.status,
      url,
      body: rawText?.slice(0, 500),
    });
    const detail = data?.error?.message || data?.error || rawText?.slice(0, 200);
    throw new Error(`HotelBeds API error [${response.status}]${detail ? `: ${detail}` : ""}`);
  }

  return data;
}

// Shorthand helpers
const bookingApi = (path: string, method: string, body?: any) =>
  hbFetch(HB_BASE, path, method, body);

const contentApi = (path: string) =>
  hbFetch(HB_CONTENT_BASE, path, "GET");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Allow service-role callers (e.g. stay.crestwelltravels.com Next.js backend)
  // without requiring a user JWT. Service role keys have role="service_role" in payload.
  let isServiceRole = false;
  try {
    const payload = JSON.parse(atob(authHeader.replace("Bearer ", "").split(".")[1]));
    isServiceRole = payload?.role === "service_role";
  } catch { /* non-JWT token — fall through to user auth */ }

  if (!isServiceRole) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const { action, ...params } = await req.json();

    let result;

    switch (action) {
      // ── Availability Search ──────────────────────────────────
      case "search": {
        const body: any = {
          stay: {
            checkIn: params.checkIn,
            checkOut: params.checkOut,
          },
          occupancies: params.occupancies || [{ rooms: 1, adults: 2, children: 0 }],
          // Cert 2.5 — Source Market tag (ISO country code of selling market)
          sourceMarket: params.sourceMarket || "US",
        };

        if (params.destination) {
          body.destination = { code: params.destination };
        }
        if (params.geolocation) {
          body.geolocation = params.geolocation;
        }
        if (params.hotels) {
          body.hotels = { hotel: params.hotels };
        }
        if (params.filter) {
          body.filter = params.filter;
        }

        result = await bookingApi("/hotels", "POST", body);
        decorateRsp(result);
        break;
      }

      // ── Check Rate (pre-booking verification) ────────────────
      case "checkrate": {
        // Cert 2.5 — one rateKey per checkRate request. If multiple are
        // supplied, fan them out and merge the responses.
        const keys: string[] = (params.rooms || []).map((r: any) => r.rateKey);
        if (keys.length <= 1) {
          result = await bookingApi("/checkrates", "POST", {
            rooms: keys.map((k) => ({ rateKey: k })),
          });
        } else {
          const responses = await Promise.all(
            keys.map((k) =>
              bookingApi("/checkrates", "POST", { rooms: [{ rateKey: k }] }),
            ),
          );
          result = { hotel: responses[0]?.hotel, results: responses };
        }
        break;
      }

      // ── Confirm Booking ──────────────────────────────────────
      case "book": {
        const body: any = {
          holder: params.holder,
          rooms: params.rooms,
          clientReference: params.clientReference || "CrestwellTravel",
        };
        if (params.remark) {
          body.remark = params.remark;
        }
        // Cert 3.13 — price tolerance (default 2%)
        body.tolerance = params.tolerance !== undefined ? params.tolerance : 2;
        result = await bookingApi("/bookings", "POST", body);
        break;
      }

      // ── Get Booking Details ──────────────────────────────────
      case "get_booking": {
        result = await bookingApi(`/bookings/${params.bookingId}`, "GET");
        break;
      }

      // ── Cancel Booking ───────────────────────────────────────
      case "cancel": {
        result = await bookingApi(
          `/bookings/${params.bookingId}?cancellationFlag=CANCELLATION`,
          "DELETE"
        );
        break;
      }

      // ── List Bookings (date range) ───────────────────────────
      case "list_bookings": {
        const from = params.from; // YYYY-MM-DD
        const to = params.to;     // YYYY-MM-DD
        const filterType = params.filterType || "CREATION"; // CREATION or CHECKIN
        result = await bookingApi(
          `/bookings?from=${from}&to=${to}&filterType=${filterType}`,
          "GET"
        );
        break;
      }

      // ── Reconfirm Booking ────────────────────────────────────
      case "reconfirm": {
        result = await bookingApi(
          `/bookings/${params.bookingId}?from=${params.from}&to=${params.to}`,
          "GET"
        );
        break;
      }

      // ── Hotel Content / Details ──────────────────────────────
      case "hotel_details": {
        const codes = Array.isArray(params.hotelCodes)
          ? params.hotelCodes.join(",")
          : params.hotelCodes;
        const lang = params.language || "ENG";
        result = await contentApi(`/hotels/${codes}?language=${lang}&useSecondaryLanguage=false`);
        break;
      }

      // ── Hotel Images ─────────────────────────────────────────
      case "hotel_images": {
        const codes = Array.isArray(params.hotelCodes)
          ? params.hotelCodes.join(",")
          : params.hotelCodes;
        result = await contentApi(`/hotels/${codes}/images`);
        break;
      }

      // ── Image Proxy — fetches GIATA images server-side (bypasses CDN IP restriction) ──
      case "image_proxy": {
        const imgPath = params.path as string;
        const size = (params.size as string) || "bigger";
        if (!imgPath || !/^[\w/.]+$/.test(imgPath)) {
          return new Response(JSON.stringify({ error: "Invalid image path" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const sizePrefix = size === "standard" ? "" : `${size}/`;
        const imageUrl = `https://photos.hotelbeds.com/giata/${sizePrefix}${imgPath}`;
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
          return new Response(JSON.stringify({ error: "Image not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const buf = await imgRes.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const ct = imgRes.headers.get("content-type") || "image/jpeg";
        return new Response(JSON.stringify({ base64: b64, contentType: ct }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Destinations List (for mapping) ──────────────────────
      case "destinations": {
        const lang = params.language || "ENG";
        const from = params.from || 1;
        const to = params.to || 100;
        result = await contentApi(`/locations/destinations?language=${lang}&from=${from}&to=${to}`);
        break;
      }

      // ── Voucher / Booking Voucher ────────────────────────────
      case "voucher": {
        // Hotelbeds doesn't have a dedicated voucher endpoint;
        // voucher data comes from booking confirmation response.
        // This action retrieves the booking and formats voucher info.
        const bookingData = await bookingApi(`/bookings/${params.bookingId}`, "GET");
        const bk = bookingData?.booking;
        if (!bk) throw new Error("Booking not found");

        result = {
          voucher: {
            reference: bk.reference,
            clientReference: bk.clientReference,
            status: bk.status,
            holder: bk.holder,
            hotel: {
              code: bk.hotel?.code,
              name: bk.hotel?.name,
              destinationName: bk.hotel?.destinationName,
              checkIn: bk.hotel?.checkIn,
              checkOut: bk.hotel?.checkOut,
              rooms: bk.hotel?.rooms,
            },
            supplier: bk.hotel?.supplier,
            remark: bk.remark,
            creationDate: bk.creationDate,
            totalNet: bk.totalNet,
            currency: bk.currency,
          },
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify({ data: result, env: HB_ENV }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("HotelBeds function error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isQuota = /\[403\]/.test(errorMessage) && /quota/i.test(errorMessage);
    const isUpstream = /\[(4\d\d|5\d\d)\]/.test(errorMessage);
    return new Response(JSON.stringify({
      error: errorMessage,
      code: isQuota ? "HOTELBEDS_QUOTA_EXCEEDED" : (isUpstream ? "HOTELBEDS_UPSTREAM_ERROR" : "HOTELBEDS_ERROR"),
      fallback: isQuota || isUpstream,
      data: null,
    }), {
      // Return 200 for upstream/quota so the client SDK doesn't blank-screen.
      status: isQuota || isUpstream ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
