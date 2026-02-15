import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const QBO_CLIENT_ID = Deno.env.get("QBO_CLIENT_ID");
  const QBO_CLIENT_SECRET = Deno.env.get("QBO_CLIENT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!QBO_CLIENT_ID || !QBO_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "QuickBooks credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  // Get authenticated user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(SUPABASE_URL!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  // Support both path-based routing and query param routing
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const path = url.searchParams.get("action") || pathSegments[pathSegments.length - 1];

  try {
    // GET /authorize - Generate OAuth URL
    if (path === "authorize" && req.method === "GET") {
      const redirectUri = url.searchParams.get("redirect_uri");
      if (!redirectUri) {
        return new Response(JSON.stringify({ error: "redirect_uri required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: QBO_CLIENT_ID,
        scope: "com.intuit.quickbooks.accounting openid profile email",
        redirect_uri: redirectUri,
        response_type: "code",
        state,
      });

      return new Response(
        JSON.stringify({ auth_url: `${QBO_AUTH_URL}?${params.toString()}`, state }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /callback - Exchange code for tokens
    if (path === "callback" && req.method === "POST") {
      const { code, redirect_uri, realm_id } = await req.json();
      if (!code || !redirect_uri || !realm_id) {
        return new Response(
          JSON.stringify({ error: "code, redirect_uri, and realm_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const basicAuth = btoa(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`);
      const tokenResp = await fetch(QBO_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri,
        }),
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        console.error("QBO token exchange failed:", tokenResp.status, errText);
        return new Response(
          JSON.stringify({ error: "Token exchange failed", details: errText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens = await tokenResp.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Get company info
      const baseUrl = "https://sandbox-quickbooks.api.intuit.com";
      const companyResp = await fetch(
        `${baseUrl}/v3/company/${realm_id}/companyinfo/${realm_id}`,
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/json",
          },
        }
      );
      let companyName = null;
      if (companyResp.ok) {
        const companyData = await companyResp.json();
        companyName = companyData.CompanyInfo?.CompanyName;
      }

      // Store connection (upsert)
      const { error: dbError } = await supabaseAdmin
        .from("qbo_connections")
        .upsert(
          {
            user_id: user.id,
            realm_id,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: expiresAt,
            company_name: companyName,
            is_active: true,
          },
          { onConflict: "user_id" }
        );

      if (dbError) {
        console.error("DB error storing QBO connection:", dbError);
        return new Response(
          JSON.stringify({ error: "Failed to store connection" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, company_name: companyName }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /refresh - Refresh access token
    if (path === "refresh" && req.method === "POST") {
      const { data: connection, error: connError } = await supabaseAdmin
        .from("qbo_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (connError || !connection) {
        return new Response(
          JSON.stringify({ error: "No active QBO connection found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const basicAuth = btoa(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`);
      const tokenResp = await fetch(QBO_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: connection.refresh_token,
        }),
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        console.error("QBO token refresh failed:", tokenResp.status, errText);
        // Mark connection as inactive if refresh fails
        await supabaseAdmin
          .from("qbo_connections")
          .update({ is_active: false })
          .eq("id", connection.id);

        return new Response(
          JSON.stringify({ error: "Token refresh failed. Please reconnect." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens = await tokenResp.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await supabaseAdmin
        .from("qbo_connections")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
        })
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /disconnect - Revoke tokens and remove connection
    if (path === "disconnect" && req.method === "POST") {
      const { data: connection } = await supabaseAdmin
        .from("qbo_connections")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (connection) {
        // Try to revoke token (best effort)
        try {
          const basicAuth = btoa(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`);
          await fetch(QBO_REVOKE_URL, {
            method: "POST",
            headers: {
              Authorization: `Basic ${basicAuth}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ token: connection.refresh_token }),
          });
        } catch (e) {
          console.error("Token revocation failed (non-critical):", e);
        }

        // Delete connection and mappings
        await supabaseAdmin.from("qbo_client_mappings").delete().eq("user_id", user.id);
        await supabaseAdmin.from("qbo_invoice_mappings").delete().eq("user_id", user.id);
        await supabaseAdmin.from("qbo_connections").delete().eq("user_id", user.id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /status - Check connection status
    if (path === "status" && req.method === "GET") {
      const { data: connection } = await supabaseAdmin
        .from("qbo_connections")
        .select("realm_id, company_name, is_active, token_expires_at, created_at")
        .eq("user_id", user.id)
        .single();

      return new Response(
        JSON.stringify({ connected: !!connection?.is_active, connection }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("QBO auth error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
