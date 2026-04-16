import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DUFFEL_BASE = "https://api.duffel.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate the agent
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

  const duffelToken = Deno.env.get("DUFFEL_API_TOKEN");
  if (!duffelToken) {
    return new Response(JSON.stringify({ error: "DUFFEL_API_TOKEN not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const duffelHeaders = {
    Authorization: `Bearer ${duffelToken}`,
    "Content-Type": "application/json",
    "Duffel-Version": "v2",
  };

  try {
    const body = await req.json();
    const { action } = body;

    // ── Search offers ──
    if (action === "search") {
      const { slices, passengers, cabin_class, max_connections } = body;
      const response = await fetch(`${DUFFEL_BASE}/air/offer_requests`, {
        method: "POST",
        headers: duffelHeaders,
        body: JSON.stringify({
          data: {
            slices,
            passengers,
            cabin_class: cabin_class || "economy",
            max_connections: max_connections ?? 1,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Duffel search failed [${response.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get single offer (optionally with available_services for baggage) ──
    if (action === "get_offer") {
      const { offer_id, return_available_services } = body;
      const qs = return_available_services ? "?return_available_services=true" : "";
      const response = await fetch(`${DUFFEL_BASE}/air/offers/${offer_id}${qs}`, {
        headers: duffelHeaders,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Duffel get offer failed [${response.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get seat maps for an offer ──
    if (action === "get_seat_maps") {
      const { offer_id } = body;
      const response = await fetch(
        `${DUFFEL_BASE}/air/seat_maps?offer_id=${encodeURIComponent(offer_id)}`,
        { headers: duffelHeaders }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Duffel seat maps failed [${response.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create order (with optional services for seats & bags) ──
    if (action === "create_order") {
      const { selected_offers, passengers, payments, services, trip_id, supplier_name, client_id, metadata } = body;
      const orderPayload: Record<string, unknown> = {
        type: "instant",
        selected_offers,
        passengers,
        payments,
      };
      if (services && services.length > 0) {
        orderPayload.services = services;
      }
      if (metadata) {
        orderPayload.metadata = metadata;
      }

      const response = await fetch(`${DUFFEL_BASE}/air/orders`, {
        method: "POST",
        headers: duffelHeaders,
        body: JSON.stringify({ data: orderPayload }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Duffel order failed [${response.status}]: ${JSON.stringify(data)}`);
      }

      // Auto-create booking + flight_orders record for commission tracking & monitoring
      const order = data?.data;
      if (order) {
        const serviceSupabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const totalAmount = parseFloat(order.total_amount || "0");

        if (trip_id) {
          const { data: newBooking } = await serviceSupabase.from("bookings").insert({
            user_id: user.id,
            trip_id,
            confirmation_number: order.booking_reference || order.id,
            status: "confirmed",
            gross_sales: totalAmount,
            total_price: totalAmount,
            net_sales: totalAmount,
            commissionable_amount: totalAmount,
            duffel_offer_id: selected_offers?.[0] || null,
          }).select("id").single();

          // Phase 4: auto-create margin line with source "duffel"
          if (newBooking) {
            await serviceSupabase.from("booking_margin_lines").insert({
              booking_id: newBooking.id,
              user_id: user.id,
              line_type: "flight",
              description: `${order.owner?.name || "Flight"} — ${order.booking_reference || order.id}`,
              source: "duffel",
              quantity: 1,
              unit_cost: totalAmount,
              unit_sell: totalAmount,
              is_pass_through: false,
              sort_order: 0,
            });

            // Trigger server-side margin calculation
            await serviceSupabase.rpc("calculate_booking_margin", {
              p_booking_id: newBooking.id,
              p_advisor_split: null,
              p_force_recalc: false,
            });
          }
        }

        // Save to flight_orders for monitoring
        const slices = order.slices || [];
        const firstSlice = slices[0];
        const lastSlice = slices[slices.length - 1];
        const flightNumbers = slices.flatMap((s: any) =>
          (s.segments || []).map((seg: any) => `${seg.operating_carrier?.iata_code || ""}${seg.operating_carrier_flight_number || ""}`)
        );
        const passengerNames = (order.passengers || []).map((p: any) => `${p.given_name} ${p.family_name}`);
        const passengerEmails = (passengers || []).map((p: any) => p.email).filter(Boolean);

        await serviceSupabase.from("flight_orders").insert({
          user_id: user.id,
          duffel_order_id: order.id,
          booking_reference: order.booking_reference || null,
          trip_id: trip_id || null,
          client_id: client_id || null,
          passenger_names: passengerNames,
          passenger_emails: passengerEmails,
          origin_iata: firstSlice?.origin?.iata_code || null,
          destination_iata: lastSlice?.destination?.iata_code || null,
          departure_at: firstSlice?.segments?.[0]?.departing_at || null,
          arrival_at: lastSlice?.segments?.slice(-1)?.[0]?.arriving_at || null,
          airline_name: order.owner?.name || null,
          flight_numbers: flightNumbers,
          total_amount: totalAmount,
          total_currency: order.total_currency || "USD",
          order_status: "confirmed",
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get order ──
    if (action === "get_order") {
      const { order_id } = body;
      const response = await fetch(`${DUFFEL_BASE}/air/orders/${order_id}`, {
        headers: duffelHeaders,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Duffel get order failed [${response.status}]: ${JSON.stringify(data)}`);
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create order cancellation ──
    if (action === "cancel_order") {
      const { order_id } = body;
      // Step 1: Create cancellation request
      const cancelResponse = await fetch(`${DUFFEL_BASE}/air/order_cancellations`, {
        method: "POST",
        headers: duffelHeaders,
        body: JSON.stringify({ data: { order_id } }),
      });
      const cancelData = await cancelResponse.json();
      if (!cancelResponse.ok) {
        throw new Error(`Duffel cancel request failed [${cancelResponse.status}]: ${JSON.stringify(cancelData)}`);
      }

      // Step 2: Confirm the cancellation
      const cancellationId = cancelData?.data?.id;
      if (cancellationId) {
        const confirmResponse = await fetch(
          `${DUFFEL_BASE}/air/order_cancellations/${cancellationId}/actions/confirm`,
          { method: "POST", headers: duffelHeaders }
        );
        const confirmData = await confirmResponse.json();
        if (!confirmResponse.ok) {
          throw new Error(`Duffel cancel confirm failed [${confirmResponse.status}]: ${JSON.stringify(confirmData)}`);
        }
        return new Response(JSON.stringify(confirmData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(cancelData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create order change ──
    if (action === "create_order_change") {
      const { order_id, slices } = body;
      // Step 1: Create change request
      const changeReqResponse = await fetch(`${DUFFEL_BASE}/air/order_change_requests`, {
        method: "POST",
        headers: duffelHeaders,
        body: JSON.stringify({ data: { order_id, slices } }),
      });
      const changeReqData = await changeReqResponse.json();
      if (!changeReqResponse.ok) {
        throw new Error(`Duffel change request failed [${changeReqResponse.status}]: ${JSON.stringify(changeReqData)}`);
      }
      return new Response(JSON.stringify(changeReqData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Confirm order change ──
    if (action === "confirm_order_change") {
      const { order_change_id, payment } = body;
      const confirmPayload: Record<string, unknown> = { };
      if (payment) confirmPayload.payment = payment;

      const response = await fetch(
        `${DUFFEL_BASE}/air/order_changes/${order_change_id}/actions/confirm`,
        {
          method: "POST",
          headers: duffelHeaders,
          body: JSON.stringify({ data: confirmPayload }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Duffel change confirm failed [${response.status}]: ${JSON.stringify(data)}`);
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create Component Client Key (for DuffelCardForm) ──
    if (action === "create_component_client_key") {
      const response = await fetch(
        `${DUFFEL_BASE}/identity/component_client_keys`,
        {
          method: "POST",
          headers: duffelHeaders,
          body: JSON.stringify({}),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Duffel client key failed [${response.status}]: ${JSON.stringify(data)}`);
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Duffel flights error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
