import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

// ── Allowed origins for CORS ─────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://cts-agent-dash.lovable.app",
  "https://app.crestwelltravels.com",
  "https://portal.crestwelltravels.com",
  "https://crestwelltravels.com",
  "https://www.crestwelltravels.com",
  "https://crestwellgetaways.com",
  "https://www.crestwellgetaways.com",
];

// Preview URLs pattern
const LOVABLE_PREVIEW_RE = /^https:\/\/.*--8ab51332-288c-4764-b4d9-392cc428e2fb\.lovable\.app$/;
const LOVABLE_PROJECT_PREVIEW_RE = /^https:\/\/.*\.lovableproject\.com$/;

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("Origin") || "";
  if (
    ALLOWED_ORIGINS.includes(origin) ||
    LOVABLE_PREVIEW_RE.test(origin) ||
    LOVABLE_PROJECT_PREVIEW_RE.test(origin)
  ) {
    return origin;
  }
  return ALLOWED_ORIGINS[0];
}

function corsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ── Allowed portal base URLs (server-side allowlist) ─────────────────────────
const ALLOWED_PORTAL_URLS = [
  "https://app.crestwelltravels.com",
  "https://portal.crestwelltravels.com",
  "https://cts-agent-dash.lovable.app",
];

function getPortalBaseUrl(): string {
  const envUrl = Deno.env.get("PORTAL_BASE_URL");
  if (envUrl && ALLOWED_PORTAL_URLS.includes(envUrl)) return envUrl;
  return ALLOWED_PORTAL_URLS[0];
}

// ── HTML escape helper ───────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Case-insensitive email matching ──────────────────────────────────────────
// clients.email is stored exactly as an agent typed it, so it can contain
// capitals. Comparing it with .eq() against a lowercased input silently misses
// those rows, and the failure surfaces to the client as the misleading
// "No client account found for this email" — the record exists, the query just
// didn't match it.
//
// ilike gives case-insensitivity, but it also treats % and _ as wildcards, and
// _ is legal in an email local part. Left unescaped, a_b@example.com would
// match aXb@example.com — a wrong-account link, not just a cosmetic bug. So
// escape the LIKE metacharacters and keep the comparison an exact one.
function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function normalizeEmail(value: string): string {
  return (value || "").toLowerCase().trim();
}

const handler = async (req: Request): Promise<Response> => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    // ── Check if a client record exists for an email ───────────────────────
    if (action === "check-client-email") {
      const emailLower = (body.email || "").toLowerCase().trim();
      if (!emailLower) {
        return new Response(JSON.stringify({ exists: false }), {
          status: 200, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id")
        .ilike("email", likeEscape(emailLower))
        .limit(1)
        .maybeSingle();

      return new Response(JSON.stringify({ exists: !!client }), {
        status: 200, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // ── Link Supabase Auth user to client_profiles (AUTHENTICATED) ─────────
    if (action === "link-client") {
      // SECURITY FIX: Derive authUserId from verified JWT, not request body
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized — Bearer token required" }), {
          status: 401, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 401, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const authUserId = authUser.id;
      const emailFromToken = authUser.email;
      // Use email from verified token, falling back to body only if token has no email
      const emailLower = (emailFromToken || body.email || "").toLowerCase().trim();

      if (!emailLower) {
        return new Response(JSON.stringify({ error: "Could not determine email from session" }), {
          status: 400, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      // Check if already linked
      const { data: existing } = await supabaseAdmin
        .from("client_profiles")
        .select("client_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (existing) {
        const { data: client } = await supabaseAdmin
          .from("clients")
          .select("id, name, first_name")
          .eq("id", existing.client_id)
          .single();

        return new Response(JSON.stringify({
          success: true,
          client_id: existing.client_id,
          client_name: client?.first_name || client?.name || "Client",
        }), {
          status: 200, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      // Find client by email
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id, name, first_name, email")
        .ilike("email", likeEscape(emailLower))
        .limit(1)
        .maybeSingle();

      if (!client) {
        return new Response(JSON.stringify({
          success: false,
          error: "No client account found for this email. Please contact your travel agent.",
        }), {
          status: 200, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      // Create the link
      const { error: insertError } = await supabaseAdmin
        .from("client_profiles")
        .insert({
          auth_user_id: authUserId,
          client_id: client.id,
        });

      if (insertError) {
        console.error("client_profiles insert error:", insertError);
        if (insertError.code === "23505") {
          const { data: existingRetry } = await supabaseAdmin
            .from("client_profiles")
            .select("client_id")
            .eq("auth_user_id", authUserId)
            .single();

          if (existingRetry) {
            return new Response(JSON.stringify({
              success: true,
              client_id: existingRetry.client_id,
              client_name: client.first_name || client.name || "Client",
            }), {
              status: 200, headers: { ...headers, "Content-Type": "application/json" },
            });
          }
        }
        throw insertError;
      }

      return new Response(JSON.stringify({
        success: true,
        client_id: client.id,
        client_name: client.first_name || client.name || "Client",
      }), {
        status: 200, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // ── Send magic link (NO caller-controlled origin) ────────────────────────
    if (action === "send-magic-link") {
      // Rate limit: 3 magic link requests per minute per IP
      const ip = getClientIP(req);
      const rl = checkRateLimit(`portal-magic:${ip}`, 3, 60);
      if (rl) return rateLimitResponse(rl.retryAfter, headers);

      const { email } = body;
      // SECURITY FIX: origin is NO LONGER accepted from request body
      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const emailLower = email.toLowerCase().trim();

      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id, name, first_name, email, user_id")
        .ilike("email", likeEscape(emailLower))
        .limit(1)
        .maybeSingle();

      if (!client) {
        // Don't reveal if email exists
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const portalToken = crypto.randomUUID() + "-" + crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: sessionError } = await supabaseAdmin
        .from("client_portal_sessions")
        .insert({
          client_id: client.id,
          token: portalToken,
          email: emailLower,
          expires_at: expiresAt.toISOString(),
        });

      if (sessionError) {
        console.error("Session creation error:", sessionError);
        throw new Error("Failed to create session");
      }

      const { data: branding } = await supabaseAdmin
        .from("branding_settings")
        .select("*")
        .eq("user_id", client.user_id)
        .maybeSingle();

      const agencyName = branding?.agency_name || "Crestwell Travel Services";
      const primaryColor = branding?.primary_color || "#0D7377";
      const logoUrl = branding?.logo_url || "";
      const fromEmail = branding?.from_email || "send@crestwellgetaways.com";
      const fromName = branding?.from_name || agencyName;

      // SECURITY FIX: Use server-side allowlist only — never caller-supplied origin
      const portalBaseUrl = getPortalBaseUrl();
      const portalUrl = `${portalBaseUrl}/client/login?token=${portalToken}`;

      // SECURITY FIX: HTML-escape all user-supplied/DB-sourced values
      const safeAgencyName = escapeHtml(agencyName);
      const safeClientName = escapeHtml(client.first_name || client.name || "Valued Client");
      const safePrimaryColor = escapeHtml(primaryColor);

      const logoHtml = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt="${safeAgencyName}" style="max-height: 60px; margin-bottom: 16px;" />`
        : "";

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="text-align: center; margin-bottom: 32px;">
            ${logoHtml}
            <h1 style="color: ${safePrimaryColor}; margin: 0;">${safeAgencyName}</h1>
            <p style="color: #6b7280; margin-top: 4px;">Client Portal</p>
          </div>
          <h2 style="color: #1f2937;">Your Portal Access Link 🔑</h2>
          <p style="color: #4b5563; line-height: 1.6;">Hello ${safeClientName},</p>
          <p style="color: #4b5563; line-height: 1.6;">Click the button below to securely access your travel portal where you can view your trips, payments, invoices, and message your travel agent.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}" style="background-color: ${safePrimaryColor}; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Access Your Portal</a>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">This link will expire in 7 days. If you didn't request this, you can safely ignore this email.</p>
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">${safeAgencyName}</p>
          </div>
        </div>
      `;

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        const resend = new Resend(RESEND_API_KEY);
        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [emailLower],
          subject: `Your ${agencyName} Portal Access Link`,
          html: emailHtml,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // ── Verify legacy token ──────────────────────────────────────────────────
    if (action === "verify-token") {
      const { token } = body;
      if (!token) {
        return new Response(JSON.stringify({ error: "Token is required" }), {
          status: 400, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const { data: session } = await supabaseAdmin
        .from("client_portal_sessions")
        .select("id, client_id, email, expires_at")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
          status: 401, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("client_portal_sessions")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", session.id);

      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id, name, first_name, last_name, email, user_id")
        .eq("id", session.client_id)
        .single();

      return new Response(JSON.stringify({
        success: true,
        client_id: session.client_id,
        client_name: client?.first_name || client?.name || "Client",
        token,
      }), {
        status: 200, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // ── Google OAuth login (authenticated — requires verified Supabase session) ─
    if (action === "google-login") {
      // SECURITY FIX: Require a verified Supabase Auth session (Google OAuth flow
      // already provides this via onAuthStateChange → link-client).
      // This action is kept for backward compatibility but now requires JWT proof.
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized — use Supabase Auth sign-in" }), {
          status: 401, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user: authUser2 }, error: authError2 } = await supabaseAuth.auth.getUser();
      if (authError2 || !authUser2) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 401, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const emailFromToken = (authUser2.email || "").toLowerCase().trim();
      if (!emailFromToken) {
        return new Response(JSON.stringify({ error: "No email in token" }), {
          status: 400, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id, name, first_name, email, user_id")
        .ilike("email", likeEscape(normalizeEmail(emailFromToken)))
        .limit(1)
        .maybeSingle();

      if (!client) {
        return new Response(JSON.stringify({
          success: false,
          error: "No client account found for this email. Please contact your travel agent.",
        }), {
          status: 200, headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const portalToken = crypto.randomUUID() + "-" + crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: sessionError } = await supabaseAdmin
        .from("client_portal_sessions")
        .insert({
          client_id: client.id,
          token: portalToken,
          email: emailFromToken,
          expires_at: expiresAt.toISOString(),
          verified_at: new Date().toISOString(),
        });

      if (sessionError) {
        console.error("Session creation error:", sessionError);
        throw new Error("Failed to create session");
      }

      return new Response(JSON.stringify({
        success: true,
        client_id: client.id,
        client_name: client.first_name || client.name || "Client",
        token: portalToken,
      }), {
        status: 200, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Portal auth error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
};

serve(handler);
