// =============================================================================
// supabase/functions/unsubscribe/index.ts
// Public endpoint hit by:
//   1. GET — recipient clicks the unsubscribe link in an email
//   2. POST — Gmail/Apple Mail one-click unsubscribe (RFC 8058)
// Token format matches send-campaign: ?e=<email>&c=<campaignId>&t=<base64url HMAC>
// =============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_SECRET = Deno.env.get("UNSUBSCRIBE_HMAC_SECRET")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function expectedToken(email: string, campaignId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${email}:${campaignId}`));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const SUCCESS_HTML = (email: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>Unsubscribed</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f6f5f1;color:#1a2238;margin:0;padding:48px 16px;}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,.06);text-align:center;}
  h1{font-family:"Playfair Display",Georgia,serif;color:#1a2238;margin:0 0 16px;font-size:28px;}
  p{line-height:1.55;color:#444;margin:0 0 12px;}
  .email{color:#b8860b;font-weight:600;}
</style></head>
<body><div class="card">
  <h1>You're unsubscribed</h1>
  <p><span class="email">${email}</span> will no longer receive marketing emails from Crestwell Travel.</p>
  <p>If this was a mistake, just reply to any past email and we'll add you back.</p>
</div></body></html>`;

const ERROR_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Invalid link</title>
<style>body{font-family:-apple-system,sans-serif;background:#f6f5f1;color:#1a2238;padding:48px 16px;text-align:center;}</style>
</head><body>
<h1>Invalid unsubscribe link</h1>
<p>This link has expired or is malformed. Reply to any of our emails and we'll handle it manually.</p>
</body></html>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  let email = url.searchParams.get("e");
  let campaignId = url.searchParams.get("c");
  let token = url.searchParams.get("t");

  // Gmail/Apple one-click POSTs form-encoded body
  if (req.method === "POST" && (!email || !campaignId || !token)) {
    try {
      const body = await req.text();
      const params = new URLSearchParams(body);
      email = email ?? params.get("e");
      campaignId = campaignId ?? params.get("c");
      token = token ?? params.get("t");
    } catch { /* ignore */ }
  }

  if (!email || !campaignId || !token) {
    return new Response(ERROR_HTML, {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const normalizedEmail = email.toLowerCase();
  const expected = await expectedToken(normalizedEmail, campaignId);
  if (!safeEqual(token, expected)) {
    return new Response(ERROR_HTML, {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    // 1. Suppress (idempotent)
    await supabase.from("email_suppressions").upsert(
      {
        email: normalizedEmail,
        reason: "unsubscribed",
        source: `campaign:${campaignId}`,
      },
      { onConflict: "email" },
    );

    // 2. Update recipient row
    await supabase
      .from("campaign_recipients")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("campaign_id", campaignId)
      .eq("email", normalizedEmail);

    // 3. Increment campaign stat
    await supabase.rpc("increment_campaign_stat", {
      p_campaign_id: campaignId,
      p_field: "total_unsubscribed",
      p_delta: 1,
    });

    if (req.method === "POST") {
      return new Response("", { status: 200, headers: corsHeaders });
    }
    return new Response(SUCCESS_HTML(normalizedEmail), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return new Response(ERROR_HTML, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }
});