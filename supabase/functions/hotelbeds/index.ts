import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Toggle between test and production environments
const HB_ENV = Deno.env.get("HOTELBEDS_ENV") || "test"; // "test" or "live"
const HB_BASE =
  HB_ENV === "live"
    ? "https://api.hotelbeds.com/hotel-api/1.0"
    : "https://api.test.hotelbeds.com/hotel-api/1.0";
const HB_CONTENT_BASE =
  HB_ENV === "live"
    ? "https://api.hotelbeds.com/hotel-content-api/1.0"
    : "https://api.test.hotelbeds.com/hotel-content-api/1.0";

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

async function hbFetch(basePath: string, path: string, method: string, body?: any) {
  const apiKey = Deno.env.get("HOTELBEDS_API_KEY");
  const apiSecret = Deno.env.get("HOTELBEDS_API_SECRET");
  if (!apiKey || !apiSecret) {
    throw new Error("HotelBeds API credentials not configured");
  }

  const signature = await generateSignature(apiKey, apiSecret);

  const headers: Record<string, string> = {
    "Api-key": apiKey,
    "X-Signature": signature,
    Accept: "application/json",
    "Accept-Encoding": "gzip", // Required by Hotelbeds certification
    "Content-Type": "application/json",
  };

  const url = `${basePath}${path}`;
  const options: RequestInit = { method, headers };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const errorMsg =
      data?.error?.message || `HotelBeds API error [${response.status}]`;
    throw new Error(errorMsg);
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
        break;
      }

      // ── Check Rate (pre-booking verification) ────────────────
      case "checkrate": {
        const body = {
          rooms: params.rooms.map((r: any) => ({ rateKey: r.rateKey })),
        };
        result = await bookingApi("/checkrates", "POST", body);
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
        if (params.tolerance !== undefined) {
          body.tolerance = params.tolerance;
        }
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
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
