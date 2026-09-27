import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require an authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (!accessKey) {
      return new Response(JSON.stringify({ error: "Unsplash is not configured yet" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, page = 1 } = await req.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return new Response(JSON.stringify({ error: "A search query is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query.trim());
    url.searchParams.set("page", String(Math.min(Math.max(1, page), 20)));
    url.searchParams.set("per_page", "18");
    url.searchParams.set("orientation", "landscape");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Unsplash API error [${res.status}]: ${body}`);
      return new Response(JSON.stringify({ error: "Photo search failed", status: res.status }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const photos = (data.results || []).map((p: any) => ({
      id: p.id,
      thumb: p.urls?.small,
      full: p.urls?.regular,
      downloadUrl: p.links?.download_location,
      photographer: p.user?.name,
      photographerUrl: p.user?.links?.html,
      alt: p.alt_description || query,
    }));

    return new Response(JSON.stringify({ photos, total: data.total || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("unsplash-search error:", err);
    return new Response(JSON.stringify({ error: "Photo search failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
