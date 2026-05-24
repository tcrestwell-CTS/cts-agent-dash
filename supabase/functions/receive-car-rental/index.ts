import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const ALLOWED_ORIGINS = [
  "https://crestwellgetaways.com",
  "https://www.crestwellgetaways.com",
];

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function n(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : null;
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Rate limit: 10 per minute per IP
  const ip = getClientIP(req);
  const rl = checkRateLimit(`receive-car-rental:${ip}`, 10, 60);
  if (rl) return rateLimitResponse(rl.retryAfter, cors);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Required fields
  const driverName = s(body.driverName);
  const driverEmail = s(body.driverEmail);
  const driverAge = s(body.driverAge);
  const pickupLocation = s(body.pickupLocation);
  const pickupDate = s(body.pickupDate);
  const pickupTime = s(body.pickupTime);
  const provider = s(body.provider);
  const vehicleClass = s(body.vehicleClass);
  const tripType = s(body.tripType);

  const missing: string[] = [];
  if (!driverName) missing.push("driverName");
  if (!driverEmail) missing.push("driverEmail");
  if (!driverAge) missing.push("driverAge");
  if (!pickupLocation) missing.push("pickupLocation");
  if (!pickupDate) missing.push("pickupDate");
  if (!pickupTime) missing.push("pickupTime");
  if (!provider) missing.push("provider");
  if (!vehicleClass) missing.push("vehicleClass");
  if (!tripType) missing.push("tripType");

  if (missing.length) {
    return new Response(
      JSON.stringify({ success: false, error: `Missing required fields: ${missing.join(", ")}` }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(driverEmail!)) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid driverEmail" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Look up client by email
  let clientId: string | null = null;
  try {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .ilike("email", driverEmail!)
      .limit(1)
      .maybeSingle();
    if (client?.id) clientId = client.id;
  } catch (e) {
    console.error("Client lookup failed:", e);
  }

  const ccPmId = s(body.ccAuthStripePmId);
  const ccAuthorized = !!ccPmId;

  const insertRow = {
    trip_type: tripType!,
    pickup_location: pickupLocation!,
    dropoff_location: s(body.dropoffLocation),
    pickup_date: pickupDate!,
    pickup_time: pickupTime!,
    return_date: s(body.returnDate),
    return_time: s(body.returnTime),
    vehicle_class: vehicleClass!,
    provider: provider!,
    loyalty_number: s(body.loyaltyNumber),
    driver_name: driverName!,
    driver_email: driverEmail!,
    driver_phone: s(body.driverPhone),
    driver_age_range: driverAge!,
    additional_drivers: n(body.additionalDrivers),
    flight_number: s(body.flightNumber),
    notes: s(body.notes),
    cc_auth_cardholder_name: s(body.ccAuthCardholderName),
    cc_auth_last_four: s(body.ccAuthLastFour),
    cc_auth_exp_month: s(body.ccAuthExpMonth),
    cc_auth_exp_year: s(body.ccAuthExpYear),
    cc_auth_billing_zip: s(body.ccAuthBillingZip),
    cc_auth_stripe_pm_id: ccPmId,
    cc_authorized: ccAuthorized,
    cc_authorized_at: ccAuthorized ? new Date().toISOString() : null,
    client_id: clientId,
    source: "public_site",
    status: "new",
  };

  const { data: inserted, error: insertError } = await supabase
    .from("car_rental_requests")
    .insert(insertRow)
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("Insert error:", insertError);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to store request" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, id: inserted.id, client_linked: !!clientId }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});