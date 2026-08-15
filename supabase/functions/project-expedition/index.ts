import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PE_KEY = Deno.env.get("PROJECT_EXPEDITION_API_KEY") ?? "";
const PE_BASE = (Deno.env.get("PROJECT_EXPEDITION_BASE_URL") ?? "https://api.projectexpedition.com/v1").replace(/\/$/, "");

// Optional supplier proxy. The proxy must explicitly support the
// `/project-expedition` contract; the Hotelbeds-only paths are not a generic
// forward proxy and must never receive a caller-controlled target URL.
const PE_PROXY_URL = (Deno.env.get("PE_PROXY_URL") ?? Deno.env.get("HOTELBEDS_MTLS_PROXY_URL") ?? "").replace(/\/+$/, "");
const PE_PROXY_TOKEN = Deno.env.get("PE_PROXY_TOKEN") ?? Deno.env.get("HOTELBEDS_MTLS_PROXY_TOKEN") ?? "";
const USE_PE_PROXY = (Deno.env.get("PE_USE_PROXY") ?? "").toLowerCase() === "true" && PE_PROXY_URL.length > 0;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function pe(path: string, init: RequestInit = {}) {
  const target = `${PE_BASE}${path}`;
  const url = USE_PE_PROXY ? `${PE_PROXY_URL}/project-expedition${path}` : target;
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-API-Key": PE_KEY,
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(USE_PE_PROXY
        ? { "X-MTLS-Proxy-Token": PE_PROXY_TOKEN }
        : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  const msg = JSON.stringify(data ?? "");
  if (!res.ok && /not whitelisted|whitelist/i.test(msg)) {
    return {
      ok: false,
      status: 403,
      data: {
        error:
          "Project Expedition rejected the request: this server's IP is not whitelisted on your API key. " +
          "Ask Project Expedition to disable IP whitelisting for this key or whitelist the proxy egress addresses assigned for this integration.",
        supplier: data,
      },
      whitelisted: false,
    };
  }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!PE_KEY) return json({ error: "PROJECT_EXPEDITION_API_KEY is not configured" }, 500);

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

    switch (action) {
      case "search": {
        const params = new URLSearchParams();
        if (body.query) params.set("q", String(body.query));
        if (body.destination) params.set("destination", String(body.destination));
        if (body.date) params.set("date", String(body.date));
        params.set("limit", String(Math.min(Number(body.limit) || 20, 50)));
        const r = await pe(`/products?${params.toString()}`);
        if (!r.ok) return json({ error: (r.data as any)?.error ?? "Project Expedition search failed", status: r.status, details: r.data }, r.status === 403 ? 403 : 502);
        const d = r.data as Record<string, unknown>;
        const products = (d?.data ?? d?.products ?? d?.results ?? d) as unknown;
        return json({ products: Array.isArray(products) ? products : [], total: (d as any)?.total ?? null });
      }

      case "product": {
        if (!body.productId) return json({ error: "productId is required" }, 400);
        const r = await pe(`/products/${encodeURIComponent(String(body.productId))}`);
        if (!r.ok) return json({ error: (r.data as any)?.error ?? "Product lookup failed", status: r.status, details: r.data }, r.status === 403 ? 403 : 502);
        return json({ product: (r.data as any)?.data ?? r.data });
      }

      case "availability": {
        if (!body.productId) return json({ error: "productId is required" }, 400);
        const params = new URLSearchParams();
        if (body.date) params.set("date", String(body.date));
        if (body.travelers) params.set("travelers", String(body.travelers));
        const r = await pe(`/products/${encodeURIComponent(String(body.productId))}/availability?${params}`);
        if (!r.ok) return json({ error: (r.data as any)?.error ?? "Availability lookup failed", status: r.status, details: r.data }, r.status === 403 ? 403 : 502);
        return json({ availability: (r.data as any)?.data ?? r.data });
      }

      case "book": {
        const required = ["productId", "travelDate", "travelers", "customerName", "customerEmail"];
        const missing = required.filter((k) => !body[k]);
        if (missing.length) return json({ error: `Missing fields: ${missing.join(", ")}` }, 400);

        const r = await pe("/bookings", {
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
        const { data: saved, error } = await supabase
          .from("project_expedition_bookings")
          .insert({
            agent_id: user.id,
            trip_id: body.tripId ?? null,
            client_id: body.clientId ?? null,
            pe_booking_ref: payload?.reference ?? payload?.booking_reference ?? payload?.id ?? null,
            pe_product_id: String(body.productId),
            product_title: String(body.productTitle ?? body.productId),
            destination: body.destination ?? null,
            travel_date: body.travelDate,
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
        if (!r.ok) return json({ error: "Project Expedition booking failed", status: r.status, details: r.data, booking: saved }, 502);
        return json({ booking: saved, supplier: payload });
      }

      case "supplier-booking": {
        if (!body.reference) return json({ error: "reference is required" }, 400);
        const r = await pe(`/bookings/${encodeURIComponent(String(body.reference))}`);
        if (!r.ok) return json({ error: (r.data as any)?.error ?? "Booking lookup failed", status: r.status, details: r.data }, r.status === 403 ? 403 : 502);
        return json({ booking: (r.data as any)?.data ?? r.data });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
