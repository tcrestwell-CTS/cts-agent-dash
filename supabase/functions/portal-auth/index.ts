import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, email, token, origin } = await req.json();

    if (action === "send-magic-link") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailLower = email.toLowerCase().trim();

      // Find client by email
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, name, first_name, email, user_id")
        .eq("email", emailLower)
        .limit(1)
        .maybeSingle();

      if (!client) {
        // Don't reveal if email exists or not
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate token
      const portalToken = crypto.randomUUID() + "-" + crypto.randomUUID();

      // Create session (expires in 7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: sessionError } = await supabase
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

      // Get agent branding for email styling
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("*")
        .eq("user_id", client.user_id)
        .maybeSingle();

      const agencyName = branding?.agency_name || "Crestwell Travel Services";
      const primaryColor = branding?.primary_color || "#0D7377";
      const logoUrl = branding?.logo_url || "";
      const fromEmail = branding?.from_email || "send@crestwellgetaways.com";
      const fromName = branding?.from_name || agencyName;

      // Use the origin from the request (so the link opens in the same browser context),
      // fall back to PORTAL_BASE_URL or published URL
      const portalBaseUrl = origin || Deno.env.get("PORTAL_BASE_URL") || "https://cts-agent-dash.lovable.app";
      const portalUrl = `${portalBaseUrl}/portal/login?token=${portalToken}`;

      const logoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${agencyName}" style="max-height: 60px; margin-bottom: 16px;" />`
        : "";

      const clientName = client.first_name || client.name || "Valued Client";

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="text-align: center; margin-bottom: 32px;">
            ${logoHtml}
            <h1 style="color: ${primaryColor}; margin: 0;">${agencyName}</h1>
            <p style="color: #6b7280; margin-top: 4px;">Client Portal</p>
          </div>
          <h2 style="color: #1f2937;">Your Portal Access Link 🔑</h2>
          <p style="color: #4b5563; line-height: 1.6;">Hello ${clientName},</p>
          <p style="color: #4b5563; line-height: 1.6;">Click the button below to securely access your travel portal where you can view your trips, payments, invoices, and message your travel agent.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}" style="background-color: ${primaryColor}; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Access Your Portal</a>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">This link will expire in 7 days. If you didn't request this, you can safely ignore this email.</p>
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">${agencyName}</p>
          </div>
        </div>
      `;

      // Send email
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
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "verify-token") {
      if (!token) {
        return new Response(JSON.stringify({ error: "Token is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find valid session
      const { data: session, error: sessionError } = await supabase
        .from("client_portal_sessions")
        .select("id, client_id, email, expires_at")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark as verified
      await supabase
        .from("client_portal_sessions")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", session.id);

      // Get client info
      const { data: client } = await supabase
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
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "google-login") {
      // Google OAuth flow: match authenticated user's email to a client
      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailLower = email.toLowerCase().trim();

      // Find client by email
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, first_name, email, user_id")
        .eq("email", emailLower)
        .limit(1)
        .maybeSingle();

      if (!client) {
        return new Response(JSON.stringify({ success: false, error: "No client account found for this email. Please contact your travel agent." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create a portal session token
      const portalToken = crypto.randomUUID() + "-" + crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: sessionError } = await supabase
        .from("client_portal_sessions")
        .insert({
          client_id: client.id,
          token: portalToken,
          email: emailLower,
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
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Portal auth error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
