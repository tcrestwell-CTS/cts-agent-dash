import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-portal-token",
};

async function validatePortalToken(supabase: any, token: string) {
  const { data: session } = await supabase
    .from("client_portal_sessions")
    .select("client_id, email, expires_at, verified_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .not("verified_at", "is", null)
    .maybeSingle();

  return session;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource");

    // ── Health check endpoint (no auth required) ──────────────────────────────
    if (resource === "health") {
      const startMs = Date.now();
      const checks: Record<string, { ok: boolean; latency_ms?: number; error?: string }> = {};

      // 1. Database connectivity – lightweight ping via count query
      try {
        const dbStart = Date.now();
        const { error: dbErr } = await supabase
          .from("client_portal_sessions")
          .select("id", { count: "exact", head: true });
        checks.database = dbErr
          ? { ok: false, error: dbErr.message }
          : { ok: true, latency_ms: Date.now() - dbStart };
      } catch (e: any) {
        checks.database = { ok: false, error: e?.message ?? "unknown" };
      }

      // 2. Session table readable (validates service-role key scope)
      try {
        const tblStart = Date.now();
        const { error: tblErr } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true });
        checks.clients_table = tblErr
          ? { ok: false, error: tblErr.message }
          : { ok: true, latency_ms: Date.now() - tblStart };
      } catch (e: any) {
        checks.clients_table = { ok: false, error: e?.message ?? "unknown" };
      }

      // 3. Env vars present
      const envVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
      const missingEnv = envVars.filter((v) => !Deno.env.get(v));
      checks.env = missingEnv.length === 0
        ? { ok: true }
        : { ok: false, error: `Missing: ${missingEnv.join(", ")}` };

      const allOk = Object.values(checks).every((c) => c.ok);
      const status = allOk ? "healthy" : "degraded";

      return new Response(
        JSON.stringify({
          status,
          function: "portal-data",
          timestamp: new Date().toISOString(),
          total_latency_ms: Date.now() - startMs,
          checks,
        }),
        {
          status: allOk ? 200 : 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Auth-gated resources ──────────────────────────────────────────────────
    const portalToken = req.headers.get("x-portal-token");
    if (!portalToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await validatePortalToken(supabase, portalToken);
    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = session.client_id;

    // Helper: find ALL client IDs sharing the same email (handles duplicate client records)
    async function getAllClientIds(): Promise<string[]> {
      const { data: client } = await supabase
        .from("clients")
        .select("email")
        .eq("id", clientId)
        .single();

      if (!client?.email) return [clientId];

      const { data: siblings } = await supabase
        .from("clients")
        .select("id")
        .eq("email", client.email);

      if (!siblings?.length) return [clientId];

      return [...new Set(siblings.map((c: any) => c.id))];
    }

    // Helper: find trips where this client is a travel companion (via email match)
    async function getCompanionTripIds(): Promise<string[]> {
      const { data: client } = await supabase
        .from("clients")
        .select("email")
        .eq("id", clientId)
        .single();

      if (!client?.email) return [];

      const { data: companions } = await supabase
        .from("client_companions")
        .select("id")
        .eq("email", client.email);

      if (!companions?.length) return [];

      const companionIds = companions.map((c: any) => c.id);

      const { data: travelerLinks } = await supabase
        .from("booking_travelers")
        .select("booking_id")
        .in("companion_id", companionIds);

      if (!travelerLinks?.length) return [];

      const bookingIds = travelerLinks.map((t: any) => t.booking_id);

      const { data: bookings } = await supabase
        .from("bookings")
        .select("trip_id")
        .in("id", bookingIds)
        .not("trip_id", "is", null);

      if (!bookings?.length) return [];

      return [...new Set(bookings.map((b: any) => b.trip_id))];
    }

    if (resource === "dashboard") {
      // Get all client IDs for this email (handles duplicates)
      const allClientIds = await getAllClientIds();

      // Get client info + own trips + recent payments + agent profile
      const [clientRes, tripsRes, companionTripIds, paymentsRes, messagesRes] = await Promise.all([
        supabase.from("clients").select("id, name, first_name, last_name, email, user_id").eq("id", clientId).single(),
        supabase.from("trips").select("id, trip_name, destination, depart_date, return_date, status, total_gross_sales").in("client_id", allClientIds).neq("status", "archived").neq("status", "cancelled").order("depart_date", { ascending: false }),
        getCompanionTripIds(),
        supabase.from("trip_payments").select("id, amount, payment_date, status, payment_type, trip_id, due_date").eq("status", "pending").order("due_date", { ascending: true }).limit(5),
        supabase.from("portal_messages").select("id, message, sender_type, created_at, read_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
      ]);

      // Fetch companion trips that aren't already in the own-trips list
      const ownTripIds = new Set((tripsRes.data || []).map((t: any) => t.id));
      const extraTripIds = companionTripIds.filter((id: string) => !ownTripIds.has(id));
      let companionTrips: any[] = [];
      if (extraTripIds.length > 0) {
        const { data } = await supabase
          .from("trips")
          .select("id, trip_name, destination, depart_date, return_date, status, total_gross_sales")
          .in("id", extraTripIds)
          .neq("status", "archived")
          .neq("status", "cancelled");
        companionTrips = data || [];
      }

      const allTrips = [...(tripsRes.data || []), ...companionTrips].sort(
        (a: any, b: any) => new Date(b.depart_date || 0).getTime() - new Date(a.depart_date || 0).getTime()
      );

      // Filter payments to only those for this client's trips
      const tripIds = allTrips.map((t: any) => t.id);
      const clientPayments = (paymentsRes.data || []).filter((p: any) => tripIds.includes(p.trip_id));

      // Fetch agent profile + branding for the client's assigned agent
      let agent = null;
      let branding = null;
      if (clientRes.data?.user_id) {
        const [agentRes, brandingRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, avatar_url, phone, job_title, clia_number, ccra_number, asta_number, embarc_number")
            .eq("user_id", clientRes.data.user_id)
            .single(),
          supabase
            .from("branding_settings")
            .select("agency_name, primary_color, accent_color, logo_url, tagline")
            .eq("user_id", clientRes.data.user_id)
            .maybeSingle(),
        ]);
        agent = agentRes.data;
        branding = brandingRes.data;
      }

      return new Response(JSON.stringify({
        client: clientRes.data,
        agent,
        branding,
        trips: allTrips,
        upcoming_payments: clientPayments,
        recent_messages: messagesRes.data || [],
        unread_messages: (messagesRes.data || []).filter((m: any) => m.sender_type === "agent" && !m.read_at).length,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "trips") {
      const allClientIds = await getAllClientIds();
      const [ownTripsRes, companionTripIds2] = await Promise.all([
        supabase
          .from("trips")
          .select("id, trip_name, destination, depart_date, return_date, status, total_gross_sales, notes, trip_type")
          .in("client_id", allClientIds)
          .neq("status", "archived")
          .neq("status", "cancelled")
          .order("depart_date", { ascending: false }),
        getCompanionTripIds(),
      ]);

      const ownIds = new Set((ownTripsRes.data || []).map((t: any) => t.id));
      const extraIds = companionTripIds2.filter((id: string) => !ownIds.has(id));
      let extraTrips: any[] = [];
      if (extraIds.length > 0) {
        const { data } = await supabase
          .from("trips")
          .select("id, trip_name, destination, depart_date, return_date, status, total_gross_sales, notes, trip_type")
          .in("id", extraIds)
          .neq("status", "archived")
          .neq("status", "cancelled");
        extraTrips = data || [];
      }

      const allTrips2 = [...(ownTripsRes.data || []), ...extraTrips].sort(
        (a: any, b: any) => new Date(b.depart_date || 0).getTime() - new Date(a.depart_date || 0).getTime()
      );

      return new Response(JSON.stringify({ trips: allTrips2 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "trip-detail") {
      const tripId = url.searchParams.get("tripId");
      if (!tripId) {
        return new Response(JSON.stringify({ error: "tripId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if client owns the trip OR is a companion on it
      const [allClientIds, companionTripIds3] = await Promise.all([
        getAllClientIds(),
        getCompanionTripIds(),
      ]);
      const isCompanion = companionTripIds3.includes(tripId);

      const [tripRes, bookingsRes, paymentsRes, itineraryRes, itinerariesRes] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).single(),
        supabase.from("bookings").select("id, booking_reference, destination, depart_date, return_date, status, total_amount, travelers, trip_name, supplier_id").eq("trip_id", tripId).neq("status", "cancelled").neq("status", "archived"),
        supabase.from("trip_payments").select("id, amount, payment_date, due_date, status, payment_type, details, notes").eq("trip_id", tripId),
        supabase.from("itinerary_items").select("id, day_number, title, description, category, start_time, end_time, location, item_date, notes, sort_order, itinerary_id").eq("trip_id", tripId).order("day_number", { ascending: true }).order("sort_order", { ascending: true }),
        supabase.from("itineraries").select("id, name, overview, cover_image_url, depart_date, return_date, sort_order").eq("trip_id", tripId).order("sort_order", { ascending: true }),
      ]);

      // Verify the client has access (either owner, sibling client record, or companion)
      if (!tripRes.data || (!allClientIds.includes(tripRes.data.client_id) && !isCompanion)) {
        return new Response(JSON.stringify({ error: "Trip not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        trip: tripRes.data,
        bookings: bookingsRes.data || [],
        payments: paymentsRes.data || [],
        itinerary: itineraryRes.data || [],
        itineraries: itinerariesRes.data || [],
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "approve-itinerary") {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "POST required" }), {
          status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { tripId, itineraryId } = await req.json();
      if (!tripId || !itineraryId) {
        return new Response(JSON.stringify({ error: "tripId and itineraryId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify client owns the trip
      const { data: tripCheck } = await supabase
        .from("trips")
        .select("id, client_id, user_id")
        .eq("id", tripId)
        .single();

      if (!tripCheck || tripCheck.client_id !== clientId) {
        return new Response(JSON.stringify({ error: "Trip not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update trip with approved itinerary
      const { error: updateError } = await supabase
        .from("trips")
        .update({
          approved_itinerary_id: itineraryId,
          itinerary_approved_at: new Date().toISOString(),
          itinerary_approved_by_client_id: clientId,
        })
        .eq("id", tripId);

      if (updateError) throw updateError;

      // Send notification message to agent
      const { data: itinData } = await supabase
        .from("itineraries")
        .select("name")
        .eq("id", itineraryId)
        .single();

      const { data: clientData } = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();

      await supabase.from("portal_messages").insert({
        client_id: clientId,
        agent_user_id: tripCheck.user_id,
        sender_type: "client",
        message: `✅ ${clientData?.name || "Client"} has approved itinerary "${itinData?.name || "Unknown"}" for this trip.`,
      });

      // Insert agent notification so it appears in the bell icon
      await supabase.from("agent_notifications").insert({
        user_id: tripCheck.user_id,
        type: "itinerary_approved",
        title: "Itinerary Approved",
        message: `${clientData?.name || "Client"} approved "${itinData?.name || "Itinerary"}" for their trip.`,
        trip_id: tripId,
      });

      // Send email alert to the agent
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          const resend = new Resend(RESEND_API_KEY);

          // Get agent email from auth.users
          const { data: agentUser } = await supabase.auth.admin.getUserById(tripCheck.user_id);
          const agentEmail = agentUser?.user?.email;

          // Get branding for styled email
          const { data: branding } = await supabase
            .from("branding_settings")
            .select("*")
            .eq("user_id", tripCheck.user_id)
            .maybeSingle();

          // Get trip name
          const { data: tripData } = await supabase
            .from("trips")
            .select("trip_name")
            .eq("id", tripId)
            .single();

          const agencyName = branding?.agency_name || "Crestwell Travel Services";
          const primaryColor = branding?.primary_color || "#0D7377";
          const logoUrl = branding?.logo_url || "";
          const fromEmail = branding?.from_email || "send@crestwellgetaways.com";
          const fromName = branding?.from_name || agencyName;
          const clientName = clientData?.name || "Your client";
          const itineraryName = itinData?.name || "an itinerary";
          const tripName = tripData?.trip_name || "their trip";

          let portalBaseUrl = Deno.env.get("PORTAL_BASE_URL") || "https://app.crestwelltravels.com";
          if (!/^https?:\/\//i.test(portalBaseUrl)) portalBaseUrl = `https://${portalBaseUrl}`;
          const dashboardUrl = portalBaseUrl.replace(/\/client.*$/, "").replace(/\/+$/, "");

          const logoHtml = logoUrl
            ? `<img src="${logoUrl}" alt="${agencyName}" style="max-height: 60px; margin-bottom: 16px;" />`
            : "";

          if (agentEmail) {
            const html = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  ${logoHtml}
                </div>
                <h2 style="color: ${primaryColor}; margin-bottom: 8px;">✅ Itinerary Approved!</h2>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                  Great news! <strong>${clientName}</strong> has approved the itinerary <strong>"${itineraryName}"</strong> for <strong>${tripName}</strong>.
                </p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                  You can now proceed with confirming bookings and next steps for this trip.
                </p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${dashboardUrl}/trips/${tripId}" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                    View Trip Details
                  </a>
                </div>
                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
                  <p style="margin: 0;">${agencyName}</p>
                </div>
              </div>
            `;

            await resend.emails.send({
              from: `${fromName} <${fromEmail}>`,
              to: [agentEmail],
              subject: `✅ ${clientName} approved "${itineraryName}" — ${tripName}`,
              html,
            });

            console.log("Itinerary approval email sent to agent:", agentEmail);
          }
        }
      } catch (emailErr) {
        // Don't fail the approval if email fails
        console.error("Failed to send itinerary approval email:", emailErr);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "invoices") {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total_amount, amount_paid, amount_remaining, status, trip_name")
        .eq("client_id", clientId)
        .order("invoice_date", { ascending: false });

      return new Response(JSON.stringify({ invoices: invoices || [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "invoice-detail") {
      const invoiceId = url.searchParams.get("invoiceId");
      if (!invoiceId) {
        return new Response(JSON.stringify({ error: "invoiceId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: invoice } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total_amount, amount_paid, amount_remaining, status, trip_name, client_name, trip_id, created_at, user_id")
        .eq("id", invoiceId)
        .eq("client_id", clientId)
        .single();

      if (!invoice) {
        return new Response(JSON.stringify({ error: "Invoice not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch client info
      const { data: clientData } = await supabase
        .from("clients")
        .select("name, email, phone")
        .eq("id", clientId)
        .single();

      // Fetch branding from the agent who owns the invoice
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("agency_name, phone, email_address, address, website, logo_url")
        .eq("user_id", invoice.user_id)
        .maybeSingle();

      // Fetch trip dates/destination if linked
      let tripInfo: any = null;
      let payments: any[] = [];
      if (invoice.trip_id) {
        const [tripRes, paymentsRes] = await Promise.all([
          supabase.from("trips").select("destination, depart_date, return_date").eq("id", invoice.trip_id).single(),
          supabase.from("trip_payments")
            .select("id, amount, payment_date, due_date, status, payment_type, details, notes")
            .eq("trip_id", invoice.trip_id)
            .order("payment_date", { ascending: true }),
        ]);
        tripInfo = tripRes.data;
        payments = paymentsRes.data || [];
      }

      return new Response(JSON.stringify({
        invoice,
        payments,
        client_email: clientData?.email,
        client_phone: clientData?.phone,
        destination: tripInfo?.destination,
        depart_date: tripInfo?.depart_date,
        return_date: tripInfo?.return_date,
        branding: branding || null,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "messages") {
      if (req.method === "POST") {
        const { message } = await req.json();
        if (!message?.trim()) {
          return new Response(JSON.stringify({ error: "Message required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get client's agent
        const { data: client } = await supabase
          .from("clients")
          .select("user_id")
          .eq("id", clientId)
          .single();

        if (!client) {
          return new Response(JSON.stringify({ error: "Client not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: newMsg, error } = await supabase
          .from("portal_messages")
          .insert({
            client_id: clientId,
            agent_user_id: client.user_id,
            sender_type: "client",
            message: message.trim(),
          })
          .select()
          .single();

        if (error) {
          console.error("Message insert error:", error);
          throw error;
        }

        return new Response(JSON.stringify({ message: newMsg }), {
          status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // GET messages
      const { data: messages } = await supabase
        .from("portal_messages")
        .select("id, message, sender_type, created_at, read_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      // Mark agent messages as read
      await supabase
        .from("portal_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .eq("sender_type", "agent")
        .is("read_at", null);

      return new Response(JSON.stringify({ messages: messages || [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "cc-authorizations") {
      // Get CC authorizations for this client
      const tripId = url.searchParams.get("tripId");

      let query = supabase
        .from("cc_authorizations")
        .select(`
          id, booking_id, authorization_amount, authorization_description,
          status, authorized_at, expires_at, access_token, created_at, last_four
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (tripId) {
        // Filter by bookings belonging to this trip
        const { data: tripBookings } = await supabase
          .from("bookings")
          .select("id")
          .eq("trip_id", tripId);
        const bookingIds = (tripBookings || []).map((b: any) => b.id);
        if (bookingIds.length > 0) {
          query = query.in("booking_id", bookingIds);
        } else {
          return new Response(JSON.stringify({ authorizations: [] }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data } = await query;

      // Enrich with booking info
      const bookingIds = [...new Set((data || []).map((a: any) => a.booking_id))];
      let bookingsMap: Record<string, any> = {};
      if (bookingIds.length > 0) {
        const { data: bookings } = await supabase
          .from("bookings")
          .select("id, booking_reference, destination, trip_name")
          .in("id", bookingIds);
        for (const b of bookings || []) {
          bookingsMap[b.id] = b;
        }
      }

      const enriched = (data || []).map((a: any) => ({
        ...a,
        booking: bookingsMap[a.booking_id] || null,
      }));

      return new Response(JSON.stringify({ authorizations: enriched }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "payments") {
      // Get all trips for this client (own + companion)
      const [ownTripsRes, companionTripIds4] = await Promise.all([
        supabase.from("trips").select("id, trip_name").eq("client_id", clientId),
        getCompanionTripIds(),
      ]);

      const allTripIds = [
        ...(ownTripsRes.data || []).map((t: any) => t.id),
        ...companionTripIds4,
      ];

      if (allTripIds.length === 0) {
        return new Response(JSON.stringify({ payments: [] }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build trip name map
      const tripNameMap: Record<string, string> = {};
      for (const t of ownTripsRes.data || []) {
        tripNameMap[t.id] = t.trip_name;
      }
      // Fetch companion trip names
      const missingIds = companionTripIds4.filter((id: string) => !tripNameMap[id]);
      if (missingIds.length > 0) {
        const { data: extraTrips } = await supabase
          .from("trips")
          .select("id, trip_name")
          .in("id", missingIds);
        for (const t of extraTrips || []) {
          tripNameMap[t.id] = t.trip_name;
        }
      }

      const { data: payments } = await supabase
        .from("trip_payments")
        .select("id, amount, payment_date, due_date, status, payment_type, payment_method, details, notes, trip_id, stripe_payment_url, stripe_receipt_url")
        .in("trip_id", allTripIds)
        .order("payment_date", { ascending: false });

      const enrichedPayments = (payments || []).map((p: any) => ({
        ...p,
        trip_name: tripNameMap[p.trip_id] || "Trip",
      }));

      return new Response(JSON.stringify({ payments: enrichedPayments }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Invalid resource" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Portal data error:", error?.message || error, error?.stack || "");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
