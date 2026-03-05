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

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
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

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "search") {
      // Create offer request
      const { slices, passengers, cabin_class, max_connections } = body;
      const response = await fetch(`${DUFFEL_BASE}/air/offer_requests`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${duffelToken}`,
          "Content-Type": "application/json",
          "Duffel-Version": "v2",
        },
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

    if (action === "get_offer") {
      const { offer_id } = body;
      const response = await fetch(`${DUFFEL_BASE}/air/offers/${offer_id}`, {
        headers: {
          Authorization: `Bearer ${duffelToken}`,
          "Duffel-Version": "v2",
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Duffel get offer failed [${response.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_order") {
      const { selected_offers, passengers, payments } = body;
      const response = await fetch(`${DUFFEL_BASE}/air/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${duffelToken}`,
          "Content-Type": "application/json",
          "Duffel-Version": "v2",
        },
        body: JSON.stringify({
          data: {
            type: "instant",
            selected_offers,
            passengers,
            payments,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Duffel order failed [${response.status}]: ${JSON.stringify(data)}`);
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
