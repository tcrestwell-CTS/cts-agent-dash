import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";
import { resolveAgentBranding } from "../_shared/agent-branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://app.crestwelltravels.com";
const SITE_URL = APP_URL;
const PAY_PATH = "/pay";
const HAWAII_PROPOSAL_TYPE = "hawaii_2027";
const HAWAII_CONFIRMATION_ITEMS = [
  "Hotel taxes and other property charges",
  "Rate-specific hotel payment and cancellation terms",
  "Cruise taxes, port expenses, and any fare components not shown",
  "NCL daily service charges and Hawaii GET tax",
  "Free at Sea benefits, eligibility, package charges, and gratuities for this booking",
  "Free at Sea Plus price and eligibility for this sailing",
  "Group amenities, cabin minimums, combinability, and dollar values",
  "Excursion availability and final prices",
];

const clean = (value: unknown, max = 1000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function buildProposalReviewEmail(opts: { brand: any; travelerName: string; tripName: string; sailing: string; cabin: string; hotel: string; total: number; serviceCharges: number; freeAtSeaEstimate: number }) {
  const b = opts.brand || {};
  const navy = b.primaryColor || b.primary_color || "#0b2545";
  const gold = b.accentColor || b.accent_color || "#c9a84c";
  const agencyName = b.agencyName || b.agency_name || "Crestwell Travel Services";
  const prepaidTotal = opts.serviceCharges + opts.freeAtSeaEstimate;
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172033"><div style="background:${navy};color:#fff;padding:28px;border-top:5px solid ${gold}"><h1 style="font-family:Georgia,serif;margin:0">Hawaii selections received</h1></div><div style="padding:28px;border:1px solid #d9dde3"><p>Hello ${opts.travelerName},</p><p>Thank you for submitting your Hawaii vacation selections. Your Crestwell advisor will verify availability, promotions, taxes, service charges, group benefits, and cancellation terms before anything is booked or charged.</p><table style="width:100%;border-collapse:collapse;margin:20px 0"><tr><td style="padding:10px;border-bottom:1px solid #ddd">Sailing</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:right"><strong>${opts.sailing}</strong></td></tr><tr><td style="padding:10px;border-bottom:1px solid #ddd">Cabin</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:right"><strong>${opts.cabin}</strong></td></tr><tr><td style="padding:10px;border-bottom:1px solid #ddd">Hotel</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:right"><strong>${opts.hotel}</strong></td></tr><tr><td style="padding:10px;border-bottom:1px solid #ddd">Known-cost estimate</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:right"><strong>${fmt(opts.total)}</strong></td></tr><tr><td style="padding:10px;border-bottom:1px solid #ddd">Estimated daily service charges</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:right"><strong>${fmt(opts.serviceCharges)}</strong></td></tr><tr><td style="padding:10px">Estimated Free at Sea package</td><td style="padding:10px;text-align:right"><strong>${fmt(opts.freeAtSeaEstimate)}</strong></td></tr><tr><td style="padding:10px;border-top:2px solid #ddd"><strong>Estimated prepaid charges before sailing</strong></td><td style="padding:10px;border-top:2px solid #ddd;text-align:right"><strong>${fmt(prepaidTotal)}</strong></td></tr></table><p style="font-size:13px;color:#64748b">This is an advisor-review request, not a confirmed reservation or payment authorization. All taxes, fees, and promotions are subject to final verification.</p></div><div style="padding:18px;text-align:center;color:#64748b;font-size:12px">${agencyName}</div></div>`;
}

// Only trust the caller's origin when it is one of our own app hosts, so the
// deposit link always points at a domain that actually serves the pay page.
function appOrigin(req: Request): string {
  const o = req.headers.get("origin") || "";
  const ok = /^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|[a-z0-9-]+\.lovable\.app|app\.crestwelltravels\.com)$/i.test(o);
  return ok ? o : APP_URL;
}

function generateToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function encodePayload(payload: Record<string, string>): string {
  return encodeURIComponent(btoa(JSON.stringify(payload)));
}

function subTrip_name(parentName: string, clientName: string): string {
  return `${parentName} — ${clientName}`;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";

function buildConfirmationEmail(opts: {
  brand: any;
  clientName: string;
  tripName: string;
  destination: string | null;
  departDate: string | null;
  returnDate: string | null;
  cabinName: string | null;
  hotelChoice: string | null;
  travelNotes: string | null;
  travelerCount: number;
  depositAmount: number;
  payUrl: string;
  reservationUrl: string;
  groupUrl: string;
}) {
  const b = opts.brand || {};
  const navy = b.primaryColor || b.primary_color || "#0b2545";
  const gold = b.accentColor || b.accent_color || "#c9a84c";
  const agencyName = b.agencyName || b.agency_name || "Crestwell Travel Services";
  const advisorName = b.advisorName || b.full_name || "Your Travel Advisor";
  const phone = b.phone || "888.508.6893";
  const logo = b.logoUrl || b.logo_url || "";
  const replyTo = b.replyTo || b.email_address || "info@crestwellgetaways.com";

  const details = [
    { label: "Trip", value: opts.tripName },
    opts.destination ? { label: "Destination", value: opts.destination } : null,
    opts.departDate ? { label: "Departure", value: fmtDate(opts.departDate) } : null,
    opts.returnDate ? { label: "Return", value: fmtDate(opts.returnDate) } : null,
    { label: "Travelers", value: String(opts.travelerCount) },
    opts.cabinName ? { label: "Cabin / category", value: opts.cabinName } : null,
    opts.travelNotes ? { label: "Departure / airfare", value: opts.travelNotes } : null,
    opts.hotelChoice ? { label: "Pre-cruise hotel", value: opts.hotelChoice } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const rows = details
    .map(
      (d, i) =>
        `<tr style="${i % 2 === 0 ? "background:#f9fafb;" : ""}"><td style="padding:12px 16px;color:#6b7280;font-size:13px;border-top:1px solid #e5e7eb;">${d.label}</td><td style="padding:12px 16px;color:#111827;text-align:right;border-top:1px solid #e5e7eb;font-weight:600;">${d.value}</td></tr>`
    )
    .join("");

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;">
    <div style="background:${navy};padding:28px 24px;text-align:center;border-radius:8px 8px 0 0;">
      ${logo ? `<img src="${logo}" alt="${agencyName}" style="max-height:54px;margin-bottom:10px;"/>` : ""}
      <div style="color:${gold};font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:0.5px;">${agencyName}</div>
    </div>
    <div style="padding:28px 28px 8px;">
      <div style="display:inline-block;background:${gold};color:${navy};padding:6px 14px;border-radius:4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Group Trip Confirmation</div>
      <h2 style="color:${navy};margin:18px 0 6px;font-family:Georgia,serif;">You're signed up, ${opts.clientName}!</h2>
      <p style="color:#4b5563;line-height:1.6;margin:8px 0 18px;">Thank you for signing up for <strong>${opts.tripName}</strong>. Below is a summary of your reservation. You can return to your personal reservation page anytime to review details or make a payment.</p>

      <table style="width:100%;border-collapse:collapse;margin:8px 0 20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        ${rows}
      </table>

      ${opts.depositAmount > 0 ? `
      <div style="background:${navy};color:#ffffff;border-radius:8px;padding:20px;margin:18px 0;">
        <div style="color:${gold};font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Deposit Due to Lock In Your Spot</div>
        <div style="font-size:32px;font-weight:700;font-family:Georgia,serif;">${fmt(opts.depositAmount)}</div>
      </div>
      ` : ""}

      <div style="text-align:center;margin:28px 0;">
        ${opts.depositAmount > 0 ? `<a href="${opts.payUrl}" style="background:${gold};color:${navy};padding:14px 36px;text-decoration:none;border-radius:6px;font-weight:700;display:inline-block;letter-spacing:0.5px;">Pay Deposit Now</a>` : ""}
        <a href="${opts.reservationUrl}" style="${opts.depositAmount > 0 ? "margin-top:12px;" : ""}color:${navy};text-decoration:underline;display:inline-block;font-weight:600;">View My Reservation</a>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:20px 0 0;">
        Questions? Reply to this email or call ${advisorName} at <a href="tel:${phone.replace(/[^0-9]/g,'')}" style="color:${navy};">${phone}</a>.
      </p>
    </div>
    <div style="background:#f9fafb;padding:18px 24px;text-align:center;color:#6b7280;font-size:12px;border-top:3px solid ${gold};border-radius:0 0 8px 8px;">
      <div style="color:${navy};font-weight:600;margin-bottom:4px;">${agencyName}</div>
      <div><a href="${opts.groupUrl}" style="color:${navy};text-decoration:none;">Return to the group trip page</a></div>
    </div>
  </div>`;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit POST signups: 3 per minute per IP
  if (req.method === "POST") {
    const ip = getClientIP(req);
    const rl = checkRateLimit(`group-signup:${ip}`, 3, 60);
    if (rl) return rateLimitResponse(rl.retryAfter, corsHeaders);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const subTripIdParam = url.searchParams.get("sub_trip_id");

    // GET (with sub_trip_id): one traveler's own reservation + a live deposit pay link
    if (req.method === "GET" && token && subTripIdParam) {
      const { data: parentTrip } = await supabaseAdmin
        .from("trips")
        .select("id, trip_name, destination, depart_date, return_date, user_id")
        .eq("share_token", token)
        .eq("trip_type", "group")
        .maybeSingle();

      if (!parentTrip) {
        return new Response(JSON.stringify({ error: "Group trip not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subTrip } = await supabaseAdmin
        .from("trips")
        .select("id, trip_name, destination, depart_date, return_date, status, notes, selected_cabin_option_id, cover_image_url, client_id, user_id")
        .eq("id", subTripIdParam)
        .eq("parent_trip_id", parentTrip.id)
        .maybeSingle();

      if (!subTrip) {
        return new Response(JSON.stringify({ error: "Reservation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [{ data: client }, { data: cabin }, { data: booking }, { data: branding }, { data: advisor }] =
        await Promise.all([
          supabaseAdmin.from("clients").select("name, email, phone").eq("id", subTrip.client_id).maybeSingle(),
          subTrip.selected_cabin_option_id
            ? supabaseAdmin
                .from("trip_cabin_options")
                .select("category_name, price_per_person, deposit_amount, description")
                .eq("id", subTrip.selected_cabin_option_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          supabaseAdmin.from("bookings").select("id, confirmation_number, gross_sales, status").eq("trip_id", subTrip.id).maybeSingle(),
          supabaseAdmin
            .from("branding_settings")
            .select("agency_name, logo_url, primary_color, accent_color, phone, email_address, website")
            .eq("user_id", subTrip.user_id)
            .maybeSingle(),
          supabaseAdmin
            .from("profiles")
            .select("full_name, agency_name, job_title, phone, avatar_url")
            .eq("user_id", subTrip.user_id)
            .maybeSingle(),
        ]);

      const { data: signupRow } = await supabaseAdmin
        .from("group_signups")
        .select("number_of_travelers")
        .eq("sub_trip_id", subTrip.id)
        .maybeSingle();
      const travelerCount = Math.max(1, Number(signupRow?.number_of_travelers) || 1);

      const { data: payments } = await supabaseAdmin
        .from("trip_payments")
        .select("id, amount, status, due_date, payment_type, payment_date")
        .eq("trip_id", subTrip.id)
        .order("created_at", { ascending: false });

      const allPayments = payments || [];
      const depositPayment =
        allPayments.find((p: any) => p.payment_type === "deposit") || null;
      const totalPaid = allPayments
        .filter((p: any) => p.status === "paid")
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

      // Build a live pay link for the deposit, minting a secure link if needed.
      let payUrl: string | null = null;
      if (depositPayment && depositPayment.status !== "paid") {
        const clientName = client?.name || "Traveler";
        const clientEmail = (client?.email || "").toLowerCase().trim();
        const ref = `TP-${depositPayment.id.slice(0, 8).toUpperCase()}`;

        const { data: existing } = await supabaseAdmin
          .from("secure_links")
          .select("token, active, expires_at")
          .eq("trip_payment_id", depositPayment.id)
          .eq("link_type", "payment")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const usable =
          existing?.token &&
          existing.active !== false &&
          (!existing.expires_at || new Date(existing.expires_at).getTime() > Date.now());

        let linkToken: string | null = usable ? existing!.token : null;

        if (!linkToken) {
          const tk = generateToken();
          const { error: mintErr } = await supabaseAdmin.from("secure_links").insert({
            token: tk,
            link_type: "payment",
            client_name: clientName,
            client_email: clientEmail,
            booking_ref: ref,
            trip_name: subTrip.trip_name,
            amount: Number(depositPayment.amount || 0),
            notes: "Group signup deposit",
            expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
            single_use: false,
            active: true,
            agent_user_id: subTrip.user_id,
            trip_payment_id: depositPayment.id,
          });
          if (mintErr) console.error("Failed to mint reservation pay link:", mintErr);
          else linkToken = tk;
        }

        if (linkToken) {
          payUrl = `${appOrigin(req)}${PAY_PATH}?d=${encodePayload({
            token: linkToken,
            ref,
            name: clientName,
            email: clientEmail,
          })}`;
        }
      }

      return new Response(
        JSON.stringify({
          parentTrip,
          subTrip,
          client: client || { name: "Traveler", email: "", phone: null },
          cabin,
          booking,
          travelerCount,
          depositPayment,
          payments: allPayments,
          totalPaid,
          payUrl,
          branding,
          advisor,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET: Return group trip landing page data (public)
    if (req.method === "GET") {
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the trip by share_token, must be group + landing enabled
      const { data: trip, error: tripErr } = await supabaseAdmin
        .from("trips")
        .select(
          "id, trip_name, destination, depart_date, return_date, status, notes, cover_image_url, total_gross_sales, trip_type, group_landing_enabled, user_id, budget_range, group_landing_headline, group_landing_description, group_landing_content"
        )
        .eq("share_token", token)
        .eq("trip_type", "group")
        .single();

      if (tripErr || !trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found or landing page not enabled" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Fetch branding for the trip owner
      const { data: branding } = await supabaseAdmin
        .from("branding_settings")
        .select("agency_name, logo_url, primary_color, accent_color, tagline, phone, email_address, website")
        .eq("user_id", trip.user_id)
        .maybeSingle();

      // Fetch advisor profile
      const { data: advisor } = await supabaseAdmin
        .from("profiles")
        .select("full_name, avatar_url, agency_name, job_title, phone, storefront_logo_url, clia_number, ccra_number, asta_number, embarc_number")
        .eq("user_id", trip.user_id)
        .maybeSingle();

      // Count existing signups
      const { count } = await supabaseAdmin
        .from("group_signups")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", trip.id);

      // Get cabin/category options
      const { data: cabinOptions } = await supabaseAdmin
        .from("trip_cabin_options")
        .select("id, category_name, description, price_per_person, deposit_amount, capacity, image_url, sort_order, price_period, requires_double_occupancy")
        .eq("trip_id", trip.id)
        .order("sort_order", { ascending: true });

      // Get all itinerary items
      const { data: itineraryItems } = await supabaseAdmin
        .from("itinerary_items")
        .select("title, description, category, day_number, location, image_url, gallery_urls, item_price")
        .eq("trip_id", trip.id)
        .order("day_number", { ascending: true })
        .order("sort_order", { ascending: true });

      return new Response(
        JSON.stringify({
          trip: {
            id: trip.id,
            trip_name: trip.trip_name,
            destination: trip.destination,
            depart_date: trip.depart_date,
            return_date: trip.return_date,
            status: trip.status,
            notes: trip.notes,
            cover_image_url: trip.cover_image_url,
            budget_range: trip.budget_range,
            group_landing_headline: trip.group_landing_headline,
            group_landing_description: trip.group_landing_description,
            group_landing_content: trip.group_landing_content,
          },
          branding,
          advisor: advisor
            ? {
                name: advisor.full_name,
                avatar_url: advisor.avatar_url,
                agency_name: advisor.agency_name,
                job_title: advisor.job_title,
                phone: advisor.phone,
                storefront_logo_url: advisor.storefront_logo_url,
                clia_number: advisor.clia_number,
                ccra_number: advisor.ccra_number,
                asta_number: advisor.asta_number,
                embarc_number: advisor.embarc_number,
              }
            : null,
          signupCount: count || 0,
          cabinOptions: cabinOptions || [],
          itineraryHighlights: itineraryItems || [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // POST: Handle a new signup
    if (req.method === "POST") {
      const body = await req.json();
      const { token: signupToken, action, first_name, last_name, email, phone, number_of_travelers, notes, selected_cabin_option_id, companion_first_name, companion_last_name, companion_email, companion_phone, departure_state, departure_city } = body;

      const travelNoteParts: string[] = [];
      if (departure_state) {
        const cityLabel = departure_city && departure_city !== "Other" ? departure_city : "(city not listed)";
        travelNoteParts.push(`Departing from: ${cityLabel}, ${departure_state}`);
      }
      const travelNotes = travelNoteParts.join(" | ") || null;

      // Validate fields shared by both generic signups and proposal requests.
      if (!signupToken || !email || (action !== "submit_proposal_selection" && !first_name)) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: token, first_name, email" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ error: "Invalid email address" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Find the parent trip
      const { data: parentTrip, error: tripErr } = await supabaseAdmin
        .from("trips")
        .select("id, user_id, trip_name, destination, depart_date, return_date, trip_type, group_landing_enabled, cover_image_url, total_gross_sales, group_landing_content")
        .eq("share_token", signupToken)
        .eq("trip_type", "group")
        .single();

      if (tripErr || !parentTrip) {
        return new Response(
          JSON.stringify({ error: "Group trip not found or signups are closed" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (action === "submit_proposal_selection") {
        const config = parentTrip.group_landing_content?.proposal_config;
        if (config?.proposal_type !== HAWAII_PROPOSAL_TYPE) {
          return new Response(JSON.stringify({ error: "This proposal is not available" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const travelerName = clean(body.traveler_name, 120);
        const partySize = Number(body.party_size);
        const sailing = Array.isArray(config.sailings) ? config.sailings.find((item: any) => item.id === body.sailing_id) : null;
        const cabin = sailing?.cabins?.find((item: any) => item.id === body.cabin_id);
        const hotel = Array.isArray(config.hotels) ? config.hotels.find((item: any) => item.id === body.hotel_id) : null;
        const room = hotel?.rooms?.find((item: any) => item.id === body.hotel_room_id);
        const allowedFas = ["standard", "plus", "need_assistance"];
        const allowedService = ["prepay", "review"];
        const allowedExcursions = ["interested", "not_interested", "need_assistance"];
        const allowedPayment = ["planned_payments", "flexpay", "affirm", "undecided"];
        const paymentPreference = allowedPayment.includes(body.payment_preference) ? body.payment_preference : "undecided";

        if (!travelerName || ![1, 2].includes(partySize) || !sailing || !cabin || !hotel || !room || body.disclosure_accepted !== true || !allowedFas.includes(body.free_at_sea_selection) || !allowedService.includes(body.service_charges_selection) || !allowedExcursions.includes(body.excursions_selection)) {
          return new Response(JSON.stringify({ error: "Please complete all required proposal selections" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const cabinTotal = Number(cabin.cabinTotal);
        const hotelBaseTotal = Number(room.prepaidTotal ?? (Number(room.nightlyRate) * Number(room.nights) + Number(room.estimatedTaxes ?? 0)));
        const hotelKnownFees = Number(room.knownPayAtProperty || 0);
        const hotelPostCheckoutRefund = Number(room.postCheckoutRefund || 0);
        const quotedTotal = cabinTotal + hotelBaseTotal + hotelKnownFees - hotelPostCheckoutRefund;
        const serviceChargePerPersonPerDay = Number(cabin.serviceChargePerPersonPerDay || 20);
        const freeAtSeaStandardPerPersonPerDay = Number(config.freeAtSeaStandardPerPersonPerDay || 28.5);
        const freeAtSeaPlusPerPersonPerDay = Number(config.freeAtSeaPlusPerPersonPerDay || 49.99);
        const cruiseNights = Number(sailing.nights) || 7;
        const serviceChargeEstimate = serviceChargePerPersonPerDay * partySize * cruiseNights;
        const freeAtSeaEstimate = body.free_at_sea_selection === "plus"
          ? freeAtSeaPlusPerPersonPerDay * partySize * cruiseNights
          : body.free_at_sea_selection === "standard"
          ? freeAtSeaStandardPerPersonPerDay * partySize * cruiseNights
          : 0;
        if (![cabinTotal, hotelBaseTotal, hotelKnownFees, hotelPostCheckoutRefund, quotedTotal, serviceChargeEstimate, freeAtSeaEstimate].every(Number.isFinite)) {
          return new Response(JSON.stringify({ error: "Proposal pricing is not configured correctly" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const { data: existingClient } = await supabaseAdmin.from("clients").select("id").eq("user_id", parentTrip.user_id).eq("email", normalizedEmail).maybeSingle();
        const { data: proposal, error: proposalError } = await supabaseAdmin.from("group_proposal_selections").insert({
          trip_id: parentTrip.id,
          user_id: parentTrip.user_id,
          client_id: existingClient?.id || null,
          traveler_name: travelerName,
          second_traveler_name: clean(body.second_traveler_name, 120) || null,
          email: normalizedEmail,
          phone: clean(phone, 40) || null,
          party_size: partySize,
          sailing_id: sailing.id,
          sailing_label: sailing.label,
          cruise_start_date: sailing.startDate,
          cruise_end_date: sailing.endDate,
          cruise_nights: cruiseNights,
          cabin_id: cabin.id,
          cabin_category: cabin.name,
          cabin_price_per_person: Number(cabin.perPerson),
          cabin_total: cabinTotal,
          hotel_id: hotel.id,
          hotel_name: hotel.name,
          hotel_room_id: room.id,
          hotel_room_type: room.name,
          hotel_check_in: sailing.hotelCheckIn,
          hotel_check_out: sailing.hotelCheckOut,
          hotel_nights: Number(room.nights),
          hotel_nightly_rate: Number(room.nightlyRate),
          hotel_base_total: hotelBaseTotal,
          hotel_known_fees: hotelKnownFees,
          cruise_service_charges: serviceChargeEstimate,
          estimated_known_total: quotedTotal,
          quoted_total: quotedTotal,
          free_at_sea_selection: body.free_at_sea_selection,
          excursions_selection: body.excursions_selection,
          optional_upgrades: { service_charges: body.service_charges_selection, payment_preference: paymentPreference, free_at_sea_total: freeAtSeaEstimate, hotel_included_taxes: Number(room.includedTaxes || 0), hotel_post_checkout_refund: hotelPostCheckoutRefund, hotel_refund_label: room.refundLabel || null },
          group_benefits: config.groupBenefits || [],
          confirmation_items: HAWAII_CONFIRMATION_ITEMS,
          special_requests: clean(body.special_requests, 1500) || null,
          accessibility_requirements: clean(body.accessibility_requirements, 1500) || null,
          additional_comments: clean(body.additional_comments, 1500) || null,
          disclosure_version: config.version || "hawaii-2027-v1",
          disclosure_accepted_at: new Date().toISOString(),
          status: "advisor_review",
          booking_status: "not_created",
          payment_status: "not_requested",
        }).select("id").single();

        if (proposalError || !proposal) {
          console.error("Failed to save proposal selection:", proposalError);
          return new Response(JSON.stringify({ error: "Unable to save your selections" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabaseAdmin.from("agent_notifications").insert({
          user_id: parentTrip.user_id,
          type: "group_proposal_review",
          title: `Hawaii proposal review: ${travelerName}`,
          message: `${travelerName} selected ${sailing.label}, ${cabin.name}, and ${hotel.name}. Known-cost estimate: ${fmt(quotedTotal)}; estimated prepaid charges: ${fmt(serviceChargeEstimate + freeAtSeaEstimate)}. Preferred payment method: ${paymentPreference.replaceAll("_", " ")}.`,
          trip_id: parentTrip.id,
        });

        try {
          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
          if (RESEND_API_KEY) {
            const brand = await resolveAgentBranding(supabaseAdmin, parentTrip.user_id);
            const { Resend } = await import("npm:resend@4.0.0");
            const resend = new Resend(RESEND_API_KEY);
            const subject = `We received your Hawaii 2027 selections`;
            const sendResp = await resend.emails.send({ from: brand.from || `${brand.agencyName} <noreply@crestwellgetaways.com>`, to: [normalizedEmail], subject, html: buildProposalReviewEmail({ brand, travelerName, tripName: parentTrip.trip_name, sailing: sailing.label, cabin: cabin.name, hotel: `${hotel.name} — ${room.name}`, total: quotedTotal, serviceCharges: serviceChargeEstimate, freeAtSeaEstimate }), replyTo: brand.replyTo || "info@crestwellgetaways.com" });
            if (!(sendResp as any)?.error) await supabaseAdmin.from("email_logs").insert({ to_email: normalizedEmail, subject, template: "hawaii_proposal_review", status: "sent", provider_message_id: (sendResp as any)?.data?.id || null, metadata: { source: "group-signup", trip_id: parentTrip.id, proposal_selection_id: proposal.id } });
          }
        } catch (emailError) {
          console.error("Proposal confirmation email failed:", emailError);
        }

        return new Response(JSON.stringify({ success: true, proposalSelectionId: proposal.id, status: "advisor_review" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check for duplicate email on this trip
      const { data: existing } = await supabaseAdmin
        .from("group_signups")
        .select("id")
        .eq("trip_id", parentTrip.id)
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: "You've already signed up for this trip!" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Enforce double-occupancy minimum on the selected cabin category
      if (selected_cabin_option_id) {
        const { data: selectedCabin } = await supabaseAdmin
          .from("trip_cabin_options")
          .select("category_name, requires_double_occupancy")
          .eq("id", selected_cabin_option_id)
          .maybeSingle();

        if (selectedCabin?.requires_double_occupancy && Number(number_of_travelers || 1) < 2) {
          return new Response(
            JSON.stringify({
              error: `${selectedCabin.category_name} requires a minimum of 2 travelers (double occupancy).`,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }


      // Find or create the client in the agent's CRM
      const clientName = `${first_name.trim()}${last_name ? " " + last_name.trim() : ""}`;
      let clientId: string;

      const { data: existingClient } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("user_id", parentTrip.user_id)
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientErr } = await supabaseAdmin
          .from("clients")
          .insert({
            user_id: parentTrip.user_id,
            name: clientName,
            first_name: first_name.trim(),
            last_name: last_name?.trim() || null,
            email: email.toLowerCase().trim(),
            phone: phone?.trim() || null,
            status: "active",
            lead_source: "group_landing",
          })
          .select("id")
          .single();

        if (clientErr || !newClient) {
          console.error("Failed to create client:", clientErr);
          return new Response(
            JSON.stringify({ error: "Failed to process signup" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        clientId = newClient.id;
      }

      // Create the sub-trip
      const { data: subTrip, error: subTripErr } = await supabaseAdmin
        .from("trips")
        .insert({
          user_id: parentTrip.user_id,
          parent_trip_id: parentTrip.id,
          trip_name: `${parentTrip.trip_name} — ${clientName}`,
          destination: parentTrip.destination,
          depart_date: parentTrip.depart_date,
          return_date: parentTrip.return_date,
          trip_type: "regular",
          status: "inbound",
          client_id: clientId,
          notes: [notes?.trim(), travelNotes].filter(Boolean).join("\n") || null,
          selected_cabin_option_id: selected_cabin_option_id || null,
          cover_image_url: parentTrip.cover_image_url,
        })
        .select("id")
        .single();

      if (subTripErr || !subTrip) {
        console.error("Failed to create sub-trip:", subTripErr);
        return new Response(
          JSON.stringify({ error: "Failed to process signup" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Record the signup
      const { error: signupErr } = await supabaseAdmin
        .from("group_signups")
        .insert({
          trip_id: parentTrip.id,
          sub_trip_id: subTrip.id,
          first_name: first_name.trim(),
          last_name: last_name?.trim() || null,
          email: email.toLowerCase().trim(),
          phone: phone?.trim() || null,
          number_of_travelers: Math.max(1, Math.min(2, parseInt(number_of_travelers) || 1)),
          notes: [travelNotes, notes?.trim()?.substring(0, 500)].filter(Boolean).join(" | ") || null,
          status: "confirmed",
        });

      if (signupErr) {
        console.error("Failed to record signup:", signupErr);
      }

      // Create booking from cabin selection
      const travelerCount = Math.max(1, Math.min(2, parseInt(number_of_travelers) || 1));
      let bookingId: string | null = null;
      let depositAmount = 0;
      let cabinLabel = "";
      if (selected_cabin_option_id) {
        const { data: cabin } = await supabaseAdmin
          .from("trip_cabin_options")
          .select("category_name, price_per_person, deposit_amount, price_period")
          .eq("id", selected_cabin_option_id)
          .single();

        if (cabin) {
          let nights = 1;
          if (cabin.price_period === "night" && parentTrip.depart_date && parentTrip.return_date) {
            const dep = new Date(parentTrip.depart_date + "T00:00:00");
            const ret = new Date(parentTrip.return_date + "T00:00:00");
            const diff = Math.round((ret.getTime() - dep.getTime()) / 86400000);
            nights = Math.max(1, diff);
          }
          const grossSales = (cabin.price_per_person || 0) * travelerCount * nights;
          const confirmNum = `GRP-${subTrip.id.substring(0, 8).toUpperCase()}`;
          cabinLabel = cabin.category_name || "";
          depositAmount = Number(cabin.deposit_amount || 0) * travelerCount;

          const { data: newBooking, error: bookingErr } = await supabaseAdmin
            .from("bookings")
            .insert({
              user_id: parentTrip.user_id,
              trip_id: subTrip.id,
              confirmation_number: confirmNum,
              status: "pending",
              gross_sales: grossSales,
              total_price: grossSales,
              net_sales: grossSales,
              commissionable_amount: grossSales,
              pricing_mode: "commission",
            })
            .select("id")
            .single();

          if (bookingErr) {
            console.error("Failed to create booking:", bookingErr);
          } else {
            bookingId = newBooking?.id ?? null;
          }
        }
      }

      // Even-split pricing: when the group trip has no cabin pricing, divide the
      // parent trip's total evenly across the trip's planned sub-trip count
      // (group_landing_content.split_travelers, falling back to confirmed signups).
      // Each sub-trip is one person, so each sub-trip's total = one even share.
      if (Number(parentTrip.total_gross_sales || 0) > 0 && !bookingId) {
        const { data: signups } = await supabaseAdmin
          .from("group_signups")
          .select("sub_trip_id, number_of_travelers")
          .eq("trip_id", parentTrip.id)
          .eq("status", "confirmed");

        const splitRows = (signups || []).filter((s) => s.sub_trip_id);
        const confirmedSubTrips = splitRows.length;
        const plannedSubTrips = Number(
          parentTrip.group_landing_content?.split_travelers || 0
        );
        const divisor = plannedSubTrips > 0 ? plannedSubTrips : confirmedSubTrips;

        if (divisor > 0) {
          const perSubTrip =
            Math.round((Number(parentTrip.total_gross_sales) / divisor) * 100) / 100;

          for (const s of splitRows) {
            const subTotal = perSubTrip;

            await supabaseAdmin
              .from("trips")
              .update({ total_gross_sales: subTotal })
              .eq("id", s.sub_trip_id);

            const { data: existingSplitBooking } = await supabaseAdmin
              .from("bookings")
              .select("id")
              .eq("trip_id", s.sub_trip_id)
              .like("confirmation_number", "GRP-%")
              .maybeSingle();

            if (existingSplitBooking) {
              await supabaseAdmin
                .from("bookings")
                .update({
                  gross_sales: subTotal,
                  total_price: subTotal,
                  net_sales: subTotal,
                  commissionable_amount: subTotal,
                })
                .eq("id", existingSplitBooking.id);

              // Keep the itemized pricing line in step with the new share so the
              // client portal shows the same total and balance as the booking.
              const { data: splitLines } = await supabaseAdmin
                .from("booking_margin_lines")
                .select("id, quantity, is_optional")
                .eq("booking_id", existingSplitBooking.id)
                .eq("is_optional", false);

              if (splitLines && splitLines.length === 1) {
                const qty = Math.max(1, Number(splitLines[0].quantity) || 1);
                await supabaseAdmin
                  .from("booking_margin_lines")
                  .update({ unit_sell: Math.round((subTotal / qty) * 100) / 100 })
                  .eq("id", splitLines[0].id);
              }
            } else {
              // Mirror the parent's bookings into this sub-trip, each line split
              // by the divisor (cost AND sell), so the advisor sees this
              // sub-trip's share of the commission. Falls back to one lump
              // booking when the parent has no itemized bookings.
              const { count: subBookingCount } = await supabaseAdmin
                .from("bookings")
                .select("id", { count: "exact", head: true })
                .eq("trip_id", s.sub_trip_id);
              if ((subBookingCount || 0) > 0) continue;

              const { data: parentBookings } = await supabaseAdmin
                .from("bookings")
                .select("id, supplier_id, status, pricing_mode, commission_estimate, advisor_split_pct, agency_split_pct")
                .eq("trip_id", parentTrip.id)
                .neq("status", "cancelled");

              let mirrored = 0;
              for (const pb of parentBookings || []) {
                const { data: plines } = await supabaseAdmin
                  .from("booking_margin_lines")
                  .select("line_type, total_cost, total_sell, sort_order, description, is_internal, is_optional, is_pass_through, source")
                  .eq("booking_id", pb.id);
                if (!plines || plines.length === 0) continue;
                const r2 = (n: number) => Math.round(n * 100) / 100;
                const lines = plines.map((l) => ({
                  ...l,
                  unit_cost: r2(Number(l.total_cost || 0) / divisor),
                  unit_sell: r2(Number(l.total_sell || 0) / divisor),
                }));
                const sell = r2(lines.reduce((a, l) => a + l.unit_sell, 0));
                const { data: nb, error: nbErr } = await supabaseAdmin
                  .from("bookings")
                  .insert({
                    user_id: parentTrip.user_id,
                    trip_id: s.sub_trip_id,
                    supplier_id: pb.supplier_id,
                    confirmation_number: `GRP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`,
                    status: "pending",
                    gross_sales: sell,
                    total_price: sell,
                    pricing_mode: pb.pricing_mode || "commission",
                    commission_estimate: pb.commission_estimate,
                    advisor_split_pct: pb.advisor_split_pct,
                    agency_split_pct: pb.agency_split_pct,
                    source: "native",
                  })
                  .select("id")
                  .single();
                if (nbErr || !nb) { console.error("Mirror booking failed:", nbErr); continue; }
                await supabaseAdmin.from("booking_margin_lines").insert(
                  lines.map((l) => ({
                    booking_id: nb.id,
                    user_id: parentTrip.user_id,
                    source: l.source || "manual",
                    quantity: 1,
                    line_type: l.line_type,
                    unit_cost: l.unit_cost,
                    unit_sell: l.unit_sell,
                    sort_order: l.sort_order,
                    description: l.description,
                    is_internal: l.is_internal,
                    is_optional: l.is_optional,
                    is_pass_through: l.is_pass_through,
                    deposit_amount: 0,
                  })),
                );
                mirrored++;
              }

              if (mirrored === 0) {
                await supabaseAdmin.from("bookings").insert({
                  user_id: parentTrip.user_id,
                  trip_id: s.sub_trip_id,
                  confirmation_number: `GRP-${String(s.sub_trip_id).substring(0, 8).toUpperCase()}`,
                  status: "pending",
                  gross_sales: subTotal,
                  total_price: subTotal,
                  net_sales: subTotal,
                  commissionable_amount: subTotal,
                  pricing_mode: "commission",
                });
              }
            }
          }
        }
      }

      // Fall back to the parent trip's deposit if the cabin has none set
      if (!depositAmount) {
        const { data: depositRow } = await supabaseAdmin
          .from("trips")
          .select("deposit_amount")
          .eq("id", parentTrip.id)
          .maybeSingle();
        depositAmount = Number(depositRow?.deposit_amount || 0) * travelerCount;
      }

      // Create the traveler's own deposit installment + secure pay link so they
      // can pay for their individual reservation right after signing up.
      let payUrl: string | null = null;
      if (depositAmount > 0) {
        const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
        const { data: depositPayment, error: depErr } = await supabaseAdmin
          .from("trip_payments")
          .insert({
            trip_id: subTrip.id,
            booking_id: bookingId,
            user_id: parentTrip.user_id,
            amount: depositAmount,
            due_date: dueDate,
            payment_type: "deposit",
            status: "pending",
            payer_name: clientName,
            payer_email: email.toLowerCase().trim(),
            notes: `Group signup deposit${cabinLabel ? ` — ${cabinLabel}` : ""} (${travelerCount} traveler${travelerCount > 1 ? "s" : ""})`,
          })
          .select("id")
          .single();

        if (depErr) {
          console.error("Failed to create deposit installment:", depErr);
        } else {
          const tk = generateToken();
          const ref = `TP-${depositPayment.id.slice(0, 8).toUpperCase()}`;
          const { error: linkErr } = await supabaseAdmin.from("secure_links").insert({
            token: tk,
            link_type: "payment",
            client_name: clientName,
            client_email: email.toLowerCase().trim(),
            booking_ref: ref,
            trip_name: subTrip_name(parentTrip.trip_name, clientName),
            amount: depositAmount,
            notes: "Group signup deposit",
            expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
            single_use: false,
            active: true,
            agent_user_id: parentTrip.user_id,
            trip_payment_id: depositPayment.id,
          });
          if (linkErr) {
            console.error("Failed to mint pay link:", linkErr);
          } else {
            payUrl = `${appOrigin(req)}${PAY_PATH}?d=${encodePayload({
              token: tk,
              ref,
              name: clientName,
              email: email.toLowerCase().trim(),
            })}`;
          }
        }
      }


      // If 2 travelers, create a companion record linked to the client
      if (travelerCount === 2 && companion_first_name?.trim()) {
        const { error: companionErr } = await supabaseAdmin
          .from("client_companions")
          .insert({
            client_id: clientId,
            user_id: parentTrip.user_id,
            first_name: companion_first_name.trim(),
            last_name: companion_last_name?.trim() || null,
            email: companion_email?.trim()?.toLowerCase() || null,
            phone: companion_phone?.trim() || null,
            relationship: "travel_companion",
          });

        if (companionErr) {
          console.error("Failed to create companion:", companionErr);
        }
      }

      // Copy parent itinerary into the sub-trip — mirrors src/lib/tripCopy.ts
      // (GROUP_SUBTRIP_COPY): itineraries + option blocks + items, no item prices
      // (group equal-share pricing drives totals) and no booking links.
      try {
        const [itRes, obRes, itemRes] = await Promise.all([
          supabaseAdmin.from("itineraries").select("*").eq("trip_id", parentTrip.id).order("sort_order"),
          supabaseAdmin.from("option_blocks").select("*").eq("trip_id", parentTrip.id),
          supabaseAdmin.from("itinerary_items").select("*").eq("trip_id", parentTrip.id),
        ]);
        const itinMap = new Map<string, string>();
        for (const it of (itRes.data as any[]) || []) {
          const { data } = await supabaseAdmin.from("itineraries").insert({
            trip_id: subTrip.id, user_id: parentTrip.user_id, name: it.name, sort_order: it.sort_order,
            cover_image_url: it.cover_image_url, overview: it.overview, depart_date: it.depart_date,
            return_date: it.return_date, header_style: it.header_style, font_style: it.font_style,
          }).select("id").single();
          if (data) itinMap.set(it.id, data.id);
        }
        const firstItin = itinMap.values().next().value ?? null;
        const blockMap = new Map<string, string>();
        const blocks = ((obRes.data as any[]) || []).map((b: any) => {
          const id = crypto.randomUUID();
          blockMap.set(b.id, id);
          return { id, trip_id: subTrip.id, user_id: parentTrip.user_id,
            itinerary_id: b.itinerary_id ? itinMap.get(b.itinerary_id) ?? firstItin : firstItin,
            day_number: b.day_number, title: b.title, sort_order: b.sort_order };
        });
        if (blocks.length) await supabaseAdmin.from("option_blocks").insert(blocks);
        const rows = ((itemRes.data as any[]) || []).map((i: any, idx: number) => ({
          trip_id: subTrip.id, user_id: parentTrip.user_id,
          itinerary_id: i.itinerary_id ? itinMap.get(i.itinerary_id) ?? firstItin : firstItin,
          option_block_id: i.option_block_id ? blockMap.get(i.option_block_id) ?? null : null,
          day_number: i.day_number, item_date: i.item_date, start_time: i.start_time, end_time: i.end_time,
          title: i.title, description: i.description, category: i.category, location: i.location,
          notes: i.notes, sort_order: i.sort_order ?? idx, flight_number: i.flight_number,
          departure_city_code: i.departure_city_code, arrival_city_code: i.arrival_city_code,
          is_hidden: i.is_hidden, image_url: i.image_url, thumbnail_url: i.thumbnail_url,
          gallery_urls: i.gallery_urls ?? [], supplier_name: i.supplier_name,
        }));
        for (let k = 0; k < rows.length; k += 200) {
          const { error } = await supabaseAdmin.from("itinerary_items").insert(rows.slice(k, k + 200));
          if (error) console.error("Failed to copy itinerary:", error);
        }
      } catch (err) {
        console.error("Failed to copy itinerary:", err);
      }

      // Create a notification for the agent
      await supabaseAdmin.from("agent_notifications").insert({
        user_id: parentTrip.user_id,
        type: "group_signup",
        title: `New Group Signup: ${clientName}`,
        message: `${clientName} signed up for ${parentTrip.trip_name} with ${travelerCount} traveler(s).`,
        trip_id: parentTrip.id,
      });

      // Build traveler-facing reservation and payment URLs.
      const origin = appOrigin(req);
      const reservationUrl = `${origin}/group/${encodeURIComponent(signupToken)}/reservation/${subTrip.id}`;
      const groupUrl = `${origin}/group/${encodeURIComponent(signupToken)}`;

      // Send a branded confirmation email with their personal reservation link.
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          const brand = await resolveAgentBranding(supabaseAdmin, parentTrip.user_id);
          const { data: cabinRow } = selected_cabin_option_id
            ? await supabaseAdmin
                .from("trip_cabin_options")
                .select("category_name")
                .eq("id", selected_cabin_option_id)
                .maybeSingle()
            : { data: null };

          const html = buildConfirmationEmail({
            brand,
            clientName,
            tripName: parentTrip.trip_name,
            destination: parentTrip.destination,
            departDate: parentTrip.depart_date,
            returnDate: parentTrip.return_date,
            cabinName: cabinRow?.category_name || cabinLabel || null,
            hotelChoice: add_prestay_hotel ? prestay_room_label || "Yes — room choice TBD" : null,
            travelNotes,
            travelerCount,
            depositAmount,
            payUrl: payUrl || groupUrl,
            reservationUrl,
            groupUrl,
          });

          const { Resend } = await import("npm:resend@4.0.0");
          const resend = new Resend(RESEND_API_KEY);
          const sendResp = await resend.emails.send({
            from: brand.from || `${brand.agencyName} <noreply@crestwellgetaways.com>`,
            to: [email.toLowerCase().trim()],
            subject: `You're signed up for ${parentTrip.trip_name}`,
            html,
            replyTo: brand.replyTo || "info@crestwellgetaways.com",
          });

          if ((sendResp as any)?.error) {
            console.error("Group signup confirmation email failed:", (sendResp as any).error);
          } else {
            // Mirror to email_logs for the Email Activity dashboard.
            await supabaseAdmin.from("email_logs").insert({
              client_id: clientId,
              to_email: email.toLowerCase().trim(),
              subject: `You're signed up for ${parentTrip.trip_name}`,
              template: "group_signup_confirmation",
              status: "sent",
              provider_message_id: (sendResp as any)?.data?.id || null,
              metadata: {
                source: "group-signup",
                trip_id: parentTrip.id,
                sub_trip_id: subTrip.id,
                pay_url: payUrl || null,
                reservation_url: reservationUrl,
              },
            });
          }
        }
      } catch (emailErr) {
        console.error("Failed to send group signup confirmation:", emailErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: payUrl
            ? "You're signed up! Pay your deposit now to lock in your cabin."
            : "You're signed up! Your travel advisor will be in touch soon.",
          payUrl,
          depositAmount,
          subTripId: subTrip.id,
          reservationUrl,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("group-signup error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
