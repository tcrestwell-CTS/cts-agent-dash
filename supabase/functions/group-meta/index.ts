import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
};

function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#\d+;/g, (match) => {
      try {
        return String.fromCharCode(Number(match.replace(/&#|;/g, "")));
      } catch {
        return match;
      }
    });
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: trip, error: tripErr } = await supabaseAdmin
      .from("trips")
      .select(
        "id, trip_name, destination, depart_date, return_date, status, notes, cover_image_url, group_landing_headline, group_landing_description, group_landing_enabled, user_id, share_token"
      )
      .eq("share_token", token)
      .eq("trip_type", "group")
      .single();

    if (tripErr || !trip) {
      return new Response(
        JSON.stringify({ error: "Trip not found or landing page not enabled" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!trip.group_landing_enabled) {
      return new Response(
        JSON.stringify({ error: "Landing page is not enabled for this trip" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: branding } = await supabaseAdmin
      .from("branding_settings")
      .select("agency_name, logo_url, tagline, website")
      .eq("user_id", trip.user_id)
      .maybeSingle();

    const { data: advisor } = await supabaseAdmin
      .from("profiles")
      .select("full_name, agency_name, storefront_logo_url")
      .eq("user_id", trip.user_id)
      .maybeSingle();

    const headline = trip.group_landing_headline || trip.trip_name;
    const rawDescription = trip.group_landing_description || trip.notes || `Join us for ${headline}`;
    const description = stripHtml(rawDescription).slice(0, 200);
    const agencyName = branding?.agency_name || advisor?.agency_name || "Crestwell Travel Network";
    const title = `${headline} — ${agencyName}`;
    const image = trip.cover_image_url || branding?.logo_url || advisor?.storefront_logo_url || "";

    const landingOrigin = Deno.env.get("GROUP_LANDING_ORIGIN") || "https://app.crestwelltravels.com";
    const landingUrl = `${landingOrigin}/group/${token}`;

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(landingUrl)}" />

    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(landingUrl)}" />
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ""}
    ${image ? `<meta property="og:image:alt" content="${escapeHtml(headline)}" />` : ""}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ""}

    <style>
      body { font-family: Inter, system-ui, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; }
      .container { max-width: 680px; margin: 0 auto; padding: 48px 24px; text-align: center; }
      h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
      p { color: #64748b; line-height: 1.6; }
      .btn { display: inline-block; margin-top: 24px; padding: 12px 24px; background: #173b75; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; }
      .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #173b75; border-radius: 50%; animation: spin 1s linear infinite; margin: 24px auto; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="spinner"></div>
      <h1>${escapeHtml(headline)}</h1>
      <p>${escapeHtml(description)}</p>
      <a class="btn" href="${escapeHtml(landingUrl)}">View Trip Details</a>
    </div>
    <script>
      setTimeout(function () {
        window.location.replace("${escapeHtml(landingUrl)}");
      }, 1500);
    </script>
  </body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
