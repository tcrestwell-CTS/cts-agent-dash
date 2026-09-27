import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  // Direct CruiseFeed probe: /probe?cruise_line=Royal%20Caribbean&region=Caribbean&departure_from=2026-12-01&departure_to=2026-12-31
  if (url.pathname.endsWith("/probe")) {
    const key = Deno.env.get("CRUISEFEED_API_KEY") ?? "";
    const params = new URLSearchParams({
      cruise_line: url.searchParams.get("cruise_line") ?? "Royal Caribbean",
      region: url.searchParams.get("region") ?? "Caribbean",
      departure_from: url.searchParams.get("departure_from") ?? "2026-12-01",
      departure_to: url.searchParams.get("departure_to") ?? "2026-12-31",
      currency: "USD",
      dedupe: "true",
      limit: url.searchParams.get("limit") ?? "3",
    });
    const res = await fetch(`https://api.cruisefeed.io/v1/cruises?${params}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    const j = await res.json().catch(() => null);
    const results = {
      _key_len: key.length,
      status: res.status,
      total: j?.total,
      count: j?.items?.length,
      allowance: j?.allowance,
      error: res.ok ? null : j,
      sample: (j?.items ?? []).map((c: any) => ({
        id: c.id, line: c.cruise_line, ship: c.ship_name, departure_date: c.departure_date,
        nights: c.nights, embark_port: c.embark_port, price_amount: c.price_amount,
        price_currency: c.price_currency, booking_url: c.booking_url, detail_url: c.detail_url,
      })),
    };
    return new Response(JSON.stringify(results, null, 2), {
      headers: { "content-type": "application/json" },
    });
  }

  const body = await req.text();
  const res = await fetch(
    "https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/triton-cruise-search",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-secret": Deno.env.get("AGENT_SECRET") ?? "",
      },
      body,
    },
  );
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
});