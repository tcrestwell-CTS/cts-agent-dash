import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  // Direct Widgety probe: /probe?operator=royal-caribbean-international&regions=caribbean&date_from=2026-08-01&date_to=2026-08-31
  if (url.pathname.endsWith("/probe")) {
    const operator = url.searchParams.get("operator") ?? "royal-caribbean-international";
    const regions = url.searchParams.get("regions") ?? "caribbean";
    const date_from = url.searchParams.get("date_from") ?? "2026-08-01";
    const date_to = url.searchParams.get("date_to") ?? "2026-08-31";
    const tokenName = url.searchParams.get("tokenName") ?? "WIDGETY_APP_TOKEN";
    const params = new URLSearchParams({
      app_id: Deno.env.get("WIDGETY_APP_ID") ?? "",
      token: Deno.env.get(tokenName) ?? "",
      market: "us",
      limit: "25",
      operators: operator,
      regions,
      date_from,
      date_to,
    });
    const results: Record<string, unknown> = {
      _using_token_env: tokenName,
      _app_id_len: (Deno.env.get("WIDGETY_APP_ID") ?? "").length,
      _token_len: (Deno.env.get(tokenName) ?? "").length,
    };
    // 1. list with region + date filter
    const r1 = await fetch(`https://www.widgety.co.uk/api/holidays.json?${params}`, {
      headers: { Accept: "application/json" },
    });
    const j1 = await r1.json().catch(() => null);
    results.with_region_and_date = { status: r1.status, total: j1?.total, count: j1?.holidays?.length, sample: j1?.holidays?.slice(0, 2) };
    // 2. without region
    const p2 = new URLSearchParams(params); p2.delete("regions");
    const r2 = await fetch(`https://www.widgety.co.uk/api/holidays.json?${p2}`, { headers: { Accept: "application/json" } });
    const j2 = await r2.json().catch(() => null);
    results.without_region = { status: r2.status, total: j2?.total, count: j2?.holidays?.length, sample: j2?.holidays?.slice(0, 2) };
    // 3. without date filter
    const p3 = new URLSearchParams(params); p3.delete("date_from"); p3.delete("date_to");
    const r3 = await fetch(`https://www.widgety.co.uk/api/holidays.json?${p3}`, { headers: { Accept: "application/json" } });
    const j3 = await r3.json().catch(() => null);
    results.without_date = { status: r3.status, total: j3?.total, count: j3?.holidays?.length, sample: j3?.holidays?.slice(0, 2) };
    // 4. no filters
    const p4 = new URLSearchParams({ app_id: params.get("app_id")!, token: params.get("token")!, market: "us", limit: "5", operators: operator });
    const r4 = await fetch(`https://www.widgety.co.uk/api/holidays.json?${p4}`, { headers: { Accept: "application/json" } });
    const j4 = await r4.json().catch(() => null);
    results.operator_only = { status: r4.status, total: j4?.total, count: j4?.holidays?.length };
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