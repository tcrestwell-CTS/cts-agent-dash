import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshIfNeeded(supabaseAdmin: any, conn: any) {
  const exp = new Date(conn.token_expires_at);
  if (exp > new Date(Date.now() + 60_000)) return conn;

  const id = Deno.env.get("QBO_CLIENT_ID")!;
  const secret = Deno.env.get("QBO_CLIENT_SECRET")!;
  const basic = btoa(`${id}:${secret}`);
  const r = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
  });
  if (!r.ok) {
    await supabaseAdmin.from("qbo_connections").update({ is_active: false }).eq("id", conn.id);
    throw new Error("QBO token expired. Please reconnect.");
  }
  const t = await r.json();
  const updated = {
    ...conn,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
  };
  await supabaseAdmin
    .from("qbo_connections")
    .update({
      access_token: updated.access_token,
      refresh_token: updated.refresh_token,
      token_expires_at: updated.token_expires_at,
    })
    .eq("id", conn.id);
  return updated;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (cErr || !claims?.claims) return json({ error: "Invalid token" }, 401);
    const callerId = claims.claims.sub as string;

    // Admin only
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admin role required" }, 403);

    const { agent_user_id } = await req.json();
    if (!agent_user_id) return json({ error: "agent_user_id required" }, 400);

    // Load payout info
    const { data: payout, error: pErr } = await supabaseAdmin
      .from("agent_payout_accounts")
      .select("*")
      .eq("user_id", agent_user_id)
      .maybeSingle();
    if (pErr) return json({ error: pErr.message }, 500);
    if (!payout) return json({ error: "No payout details on file for this agent" }, 400);

    // Load agent profile for name fallback
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, agency_name, phone")
      .eq("user_id", agent_user_id)
      .maybeSingle();

    // Caller must have an active QBO connection
    let conn: any;
    {
      const { data, error } = await supabaseAdmin
        .from("qbo_connections")
        .select("*")
        .eq("user_id", callerId)
        .eq("is_active", true)
        .single();
      if (error || !data) return json({ error: "Connect QuickBooks first" }, 400);
      conn = data;
    }
    conn = await refreshIfNeeded(supabaseAdmin, conn);

    const qboBase = `${QBO_BASE}/${conn.realm_id}`;
    const headers = {
      Authorization: `Bearer ${conn.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const displayName = (
      payout.business_name || payout.payee_name || profile?.full_name || "Agent"
    ).slice(0, 100);
    const safeDisplay = displayName.replace(/'/g, "\\'");

    // Look up existing
    let qboVendorId: string | null = null;
    const lookup = await fetch(
      `${qboBase}/query?query=${encodeURIComponent(
        `SELECT * FROM Vendor WHERE DisplayName = '${safeDisplay}'`,
      )}`,
      { headers },
    );
    if (lookup.ok) {
      const j = await lookup.json();
      const matches = j.QueryResponse?.Vendor || [];
      if (matches.length) qboVendorId = matches[0].Id;
    }

    const vendorBody: any = {
      DisplayName: displayName,
      CompanyName: (payout.business_name || displayName).slice(0, 100),
      PrintOnCheckName: (payout.payee_name || displayName).slice(0, 100),
      Vendor1099: payout.tax_form === "W9",
    };
    if (payout.email) vendorBody.PrimaryEmailAddr = { Address: payout.email.slice(0, 100) };
    const phone = payout.phone || profile?.phone;
    if (phone) vendorBody.PrimaryPhone = { FreeFormNumber: String(phone).slice(0, 30) };
    if (payout.address_line1) {
      vendorBody.BillAddr = {
        Line1: payout.address_line1.slice(0, 500),
        Line2: payout.address_line2 ? payout.address_line2.slice(0, 500) : undefined,
        City: payout.city || undefined,
        CountrySubDivisionCode: payout.state || undefined,
        PostalCode: payout.postal_code || undefined,
        Country: payout.country || "US",
      };
    }

    if (qboVendorId) {
      // Update — fetch SyncToken
      const cur = await fetch(`${qboBase}/vendor/${qboVendorId}`, { headers });
      const curJson = await cur.json();
      const syncToken = curJson?.Vendor?.SyncToken ?? "0";
      vendorBody.Id = qboVendorId;
      vendorBody.SyncToken = syncToken;
      vendorBody.sparse = true;
      const upd = await fetch(`${qboBase}/vendor`, {
        method: "POST",
        headers,
        body: JSON.stringify(vendorBody),
      });
      if (!upd.ok) return json({ error: "QBO vendor update failed", details: await upd.text() }, 502);
    } else {
      const cr = await fetch(`${qboBase}/vendor`, {
        method: "POST",
        headers,
        body: JSON.stringify(vendorBody),
      });
      if (!cr.ok) return json({ error: "QBO vendor create failed", details: await cr.text() }, 502);
      const j = await cr.json();
      qboVendorId = j.Vendor.Id as string;
    }

    // Upsert mapping
    const { error: mErr } = await supabaseAdmin
      .from("qbo_agent_vendor_mappings")
      .upsert(
        {
          agent_user_id,
          qbo_vendor_id: qboVendorId,
          qbo_realm_id: conn.realm_id,
          vendor_display_name: displayName,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "agent_user_id" },
      );
    if (mErr) return json({ error: mErr.message }, 500);

    return json({
      success: true,
      qbo_vendor_id: qboVendorId,
      vendor_display_name: displayName,
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});