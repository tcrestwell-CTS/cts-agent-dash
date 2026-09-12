// TEMPORARY one-shot relay: triggers ctn-approve for a single hard-coded,
// owner-authorized manual approval (Elvira Cruz) using the project's own
// CTN_APPROVE_SECRET, so the secret never leaves this environment.
// This function is deleted immediately after use.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const responseHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const FIXED_PAYLOAD = {
  email: "elviracruzwpb@gmail.com",
  first_name: "Elvira",
  plan: "starter",
  application_id: "e9f4c408-b173-44b7-848e-12c55410fd3f",
  stripe_customer_id: "cus_VFL8WwjcD7DKxQ",
  stripe_subscription_id: "sub_1UEqRwPJljF0WNcYyCsETYL2",
  payment_status: "paid",
  match_method: "manual_override",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: responseHeaders });
  }

  const secret = Deno.env.get("CTN_APPROVE_SECRET") || Deno.env.get("CW_AGENT_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "No approval secret configured" }), { status: 500, headers: responseHeaders });
  }

  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ctn-approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-agent-secret": secret },
    body: JSON.stringify(FIXED_PAYLOAD),
  });

  const text = await res.text();
  return new Response(JSON.stringify({ upstream_status: res.status, upstream_body: text }), {
    status: 200,
    headers: responseHeaders,
  });
});
