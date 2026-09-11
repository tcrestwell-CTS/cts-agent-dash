import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://crestwellgetaways.com";
const PAY_PATH = "/payment";

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
        .select("title, description, category, day_number, location")
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
      const { token: signupToken, first_name, last_name, email, phone, number_of_travelers, notes, selected_cabin_option_id, companion_first_name, companion_last_name, companion_email, companion_phone } = body;

      // Validate required fields
      if (!signupToken || !first_name || !email) {
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
        .select("id, user_id, trip_name, destination, depart_date, return_date, trip_type, group_landing_enabled, cover_image_url")
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
          notes: notes?.trim() || null,
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
          notes: notes?.trim()?.substring(0, 500) || null,
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
            payUrl = `${SITE_URL}${PAY_PATH}?d=${encodePayload({
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

      // Copy parent trip itinerary items to sub-trip
      const { data: parentItems } = await supabaseAdmin
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", parentTrip.id)
        .order("day_number", { ascending: true })
        .order("sort_order", { ascending: true });

      if (parentItems && parentItems.length > 0) {
        const itineraryInserts = parentItems.map((item: any, idx: number) => ({
          trip_id: subTrip.id,
          user_id: parentTrip.user_id,
          day_number: item.day_number,
          title: item.title,
          description: item.description,
          category: item.category,
          location: item.location,
          start_time: item.start_time,
          end_time: item.end_time,
          item_date: item.item_date,
          notes: item.notes,
          sort_order: item.sort_order ?? idx,
        }));

        const { error: itinErr } = await supabaseAdmin
          .from("itinerary_items")
          .insert(itineraryInserts);

        if (itinErr) {
          console.error("Failed to copy itinerary:", itinErr);
        }
      }

      // Create a notification for the agent
      await supabaseAdmin.from("agent_notifications").insert({
        user_id: parentTrip.user_id,
        type: "group_signup",
        title: `New Group Signup: ${clientName}`,
        message: `${clientName} signed up for ${parentTrip.trip_name} with ${travelerCount} traveler(s).`,
        trip_id: parentTrip.id,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: payUrl
            ? "You're signed up! Pay your deposit now to lock in your cabin."
            : "You're signed up! Your travel advisor will be in touch soon.",
          payUrl,
          depositAmount,
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
