// =============================================================================
// adx — Edge Function
// Proxy for the ADX booking platform (Travel Edge / TripArc, via Ensemble).
// Actions: status, search, product, availability, book, booking-lookup.
//
// Until ADX_API_KEY is configured the function reports `configured: false`
// so the UI can fall back to "track only" mode (log bookings manually with
// the ADX (Travel Edge) supplier instead of failing hard.
//
// On a successful booking this function also creates the CRM booking, a
// booking_margin_lines row, and fires calculate_booking_margin so ADX sales
// flow through the margin engine exactly like manually logged bookings.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ADX_KEY = Deno.env.get("ADX_API_KEY") ?? "";
const ADX_BASE = (Deno.env.get("ADX_BASE_URL") ?? "https://api.traveledge.com/adx/v1").replace(/\/$/, "");
const CONFIGURED = ADX_KEY.length > 0;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function adx(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ADX_BASE}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${ADX_KEY}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "status") return json({ configured: CONFIGURED });

    if (!CONFIGURED) {
      return json({
        error: "ADX API is not connected yet. Request API access through Ensemble / Travel Edge, then add the credentials to enable search and booking.",
        code: "ADX_NOT_CONFIGURED",
        configured: false,
      });
    }

    switch (action) {
      case "search": {
        const params = new URLSearchParams();
        if (body.query) params.set("q", String(body.query));
        if (body.destination) params.set("destination", String(body.destination));
        if (body.date) params.set("date", String(body.date));
        if (body.productType) params.set("type", String(body.productType));
        params.set("limit", String(Math.min(Number(body.limit) || 20, 50)));
        const r = await adx(`/products?${params.toString()}`);
        if (!r.ok) {
          return json({ error: (r.data as any)?.error ?? "ADX search failed", status: r.status, details: r.data }, 502);
        }
        const d = r.data as Record<string, unknown>;
        const products = (d?.data ?? d?.products ?? d?.results ?? d) as unknown;
        return json({ products: Array.isArray(products) ? products : [], total: (d as any)?.total ?? null });
      }

      case "product": {
        if (!body.productId) return json({ error: "productId is required" }, 400);
        const r = await adx(`/products/${encodeURIComponent(String(body.productId))}`);
        if (!r.ok) return json({ error: (r.data as any)?.error ?? "Product lookup failed", status: r.status, details: r.data }, 502);
        return json({ product: (r.data as any)?.data ?? r.data });
      }

      case "availability": {
        if (!body.productId) return json({ error: "productId is required" }, 400);
        const params = new URLSearchParams();
        if (body.date) params.set("date", String(body.date));
        if (body.travelers) params.set("travelers", String(body.travelers));
        const r = await adx(`/products/${encodeURIComponent(String(body.productId))}/availability?${params}`);
        if (!r.ok) return json({ error: (r.data as any)?.error ?? "Availability lookup failed", status: r.status, details: r.data }, 502);
        return json({ availability: (r.data as any)?.data ?? r.data });
      }

      case "book": {
        const required = ["productId", "travelDate", "travelers", "customerName", "customerEmail"];
        const missing = required.filter((k) => !body[k]);
        if (missing.length) return json({ error: `Missing fields: ${missing.join(", ")}` }, 400);

        const r = await adx("/bookings", {
          method: "POST",
          body: JSON.stringify({
            product_id: body.productId,
            travel_date: body.travelDate,
            travelers: Number(body.travelers),
            option_id: body.optionId ?? undefined,
            customer: { name: body.customerName, email: body.customerEmail, phone: body.customerPhone ?? undefined },
            notes: body.notes ?? undefined,
          }),
        });

        const payload = (r.data as any)?.data ?? r.data ?? {};
        const adxRef = payload?.reference ?? payload?.booking_reference ?? payload?.confirmation ?? payload?.id ?? null;

        // 1. Persist the ADX booking record
        const { data: saved, error } = await supabase
          .from("adx_bookings")
          .insert({
            agent_id: user.id,
            trip_id: body.tripId ?? null,
            client_id: body.clientId ?? null,
            adx_booking_ref: adxRef ? String(adxRef) : null,
            adx_product_id: String(body.productId),
            product_title: String(body.productTitle ?? body.productId),
            product_type: body.productType ?? null,
            destination: body.destination ?? null,
            travel_date: body.travelDate,
            return_date: body.returnDate ?? null,
            travelers: Number(body.travelers),
            customer_name: body.customerName,
            customer_email: body.customerEmail,
            currency: payload?.currency ?? body.currency ?? "USD",
            total_price: Number(payload?.total_price ?? body.totalPrice ?? 0),
            net_price: payload?.net_price ?? null,
            commission: payload?.commission ?? null,
            status: r.ok ? (payload?.status ?? "confirmed") : "failed",
            raw_response: payload,
            notes: body.notes ?? null,
          })
          .select()
          .single();

        if (error) return json({ error: error.message, supplier: r.data }, 500);
        if (!r.ok) return json({ error: "ADX booking failed", status: r.status, details: r.data, booking: saved }, 502);

        // 2. Create the CRM booking + margin line so the sale flows through
        //    the margin engine like any manually logged ADX booking.
        let crmBookingId: string | null = null;
        const gross = Number(payload?.total_price ?? body.totalPrice ?? 0);
        if (gross > 0) {
          const { data: adxSupplier } = await supabase
            .from("suppliers")
            .select("id, commission_rate")
            .ilike("name", "adx%")
            .limit(1)
            .maybeSingle();

          const rate = Number(adxSupplier?.commission_rate ?? 10);
          const net = Number(payload?.net_price ?? 0);
          const commission = Number(payload?.commission ?? 0) ||
            Math.round((gross - net) * (rate / 100) * 100) / 100;
          const conf = adxRef ? String(adxRef) : `ADX-${Date.now()}`;

          const { data: crmBooking, error: bErr } = await supabase
            .from("bookings")
            .insert({
              user_id: user.id,
              trip_id: body.tripId ?? null,
              confirmation_number: conf,
              gross_sales: gross,
              total_price: gross,
              commissionable_amount: gross - net,
              commission_revenue: commission,
              net_sales: gross - net,
              commission_estimate: rate,
              supplier_id: adxSupplier?.id ?? null,
              supplier_confirmation_number: conf,
              status: "pending",
            })
            .select()
            .single();

          if (bErr) {
            console.error("[adx] CRM booking insert failed:", bErr.message);
          } else if (crmBooking) {
            crmBookingId = crmBooking.id;
            await supabase.from("booking_margin_lines").insert({
              booking_id: crmBooking.id,
              user_id: user.id,
              line_type: "package",
              description: String(body.productTitle ?? "ADX booking"),
              source: "api",
              quantity: 1,
              unit_cost: net,
              unit_sell: gross,
              is_pass_through: false,
              sort_order: 0,
            });
            const { error: mErr } = await supabase.rpc("calculate_booking_margin", {
              p_booking_id: crmBooking.id,
              p_advisor_split: null,
              p_force_recalc: false,
            });
            if (mErr) console.error("[adx] margin calc error:", mErr.message);
            await supabase.from("adx_bookings").update({ booking_id: crmBooking.id }).eq("id", saved.id);
          }
        }

        return json({ booking: saved, crm_booking_id: crmBookingId, supplier: payload });
      }

      case "booking-lookup": {
        if (!body.reference) return json({ error: "reference is required" }, 400);
        const r = await adx(`/bookings/${encodeURIComponent(String(body.reference))}`);
        if (!r.ok) return json({ error: (r.data as any)?.error ?? "Booking lookup failed", status: r.status, details: r.data }, 502);
        return json({ booking: (r.data as any)?.data ?? r.data });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
