import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
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