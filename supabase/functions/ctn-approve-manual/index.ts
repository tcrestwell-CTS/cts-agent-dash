// TEMPORARY internal relay: lets an authorized operator trigger ctn-approve
// with the project's own CTN_APPROVE_SECRET, without that secret leaving the
// environment. Requires the internal LOVABLE_API_KEY header.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const responseHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": "authorization, content-type, x-internal-key",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: responseHeaders });
  }

  const provided = req.headers.get("x-internal-key") || "";
  const expected = Deno.env.get("LOVABLE_API_KEY") || "";
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: responseHeaders });
  }

  const secret = Deno.env.get("CTN_APPROVE_SECRET") || Deno.env.get("CW_AGENT_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "No approval secret configured" }), { status: 500, headers: responseHeaders });
  }

  const payload = await req.text();
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ctn-approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": secret,
    },
    body: payload,
  });

  const text = await res.text();
  return new Response(JSON.stringify({ upstream_status: res.status, upstream_body: text }), {
    status: 200,
    headers: responseHeaders,
  });
});
