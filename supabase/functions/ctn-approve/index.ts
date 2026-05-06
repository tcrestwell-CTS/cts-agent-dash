// supabase/functions/ctn-approve/index.ts
// Called by CTN-Hosting admin dashboard when approving an agent application
// Accepts: { email, first_name, plan, reviewer_notes, secret }
// Does:
//   1. Validates the CTN agent secret
//   2. Creates invitation row in invitations table
//   3. Fires send-email edge function with agent_invitation template
// The service role key never leaves this environment

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-agent-secret",
};

const PLAN_TO_TIER: Record<string, string> = {
  starter:      "tier_1",
  professional: "tier_2",
  elite:        "tier_3",
  unsure:       "tier_1",
};

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Auth: accept either x-agent-secret OR Authorization Bearer with service role key
  const agentSecret = req.headers.get("x-agent-secret");
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.replace("Bearer ", "").trim();

  const validSecrets = [
    Deno.env.get("CTN_APPROVE_SECRET"),
    Deno.env.get("AGENT_SECRET"),
    Deno.env.get("CW_AGENT_SECRET"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  ].filter(Boolean);

  const providedToken = agentSecret || bearerToken;

  if (!providedToken || !validSecrets.includes(providedToken)) {
    console.error("[ctn-approve] Auth failed. Provided:", providedToken?.slice(0, 10));
    console.error("[ctn-approve] Available secrets configured:", validSecrets.map(s => s?.slice(0, 10)));
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { email, first_name, plan, application_id } = body;

    if (!email || !plan) {
      return new Response(JSON.stringify({ error: "email and plan required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const commissionTier = PLAN_TO_TIER[plan] || "tier_1";
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // ── Check if user already exists in auth.users ───────────────────────
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      console.log(`[ctn-approve] User ${email} already exists — ensuring agent role`);
      // Ensure profile exists (required for the user to show up on the team page)
      const fullName =
        (existingUser.user_metadata as Record<string, unknown> | null)?.full_name as string | undefined ||
        first_name ||
        email.split("@")[0];
      const avatarUrl =
        (existingUser.user_metadata as Record<string, unknown> | null)?.avatar_url as string | undefined || null;

      const { error: profileErr } = await supabase.from("profiles").upsert(
        {
          user_id: existingUser.id,
          full_name: fullName,
          avatar_url: avatarUrl,
          commission_tier: commissionTier,
          agency_name: "Crestwell Travel Services",
        },
        { onConflict: "user_id" }
      );
      if (profileErr) console.error("[ctn-approve] profile upsert error:", profileErr);

      // Assign 'user' role (the standard agent role in app_role enum). Don't overwrite admins.
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (!existingRole) {
        const { error: roleErr } = await supabase
          .from("user_roles")
          .insert({ user_id: existingUser.id, role: "user" });
        if (roleErr) console.error("[ctn-approve] role insert error:", roleErr);
      }

      const inviteUrl = `https://app.crestwelltravels.com/auth`;
      return new Response(
        JSON.stringify({ success: true, email, tier: commissionTier, invite_url: inviteUrl, note: "existing_user_role_updated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Check for existing pending invitation ─────────────────────────────
    const { data: existing } = await supabase
      .from("invitations")
      .select("id, token")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    let inviteToken = token;

    if (existing) {
      // Reuse existing token, extend expiry
      await supabase
        .from("invitations")
        .update({ expires_at: expiresAt.toISOString() })
        .eq("id", existing.id);
      inviteToken = existing.token;
      console.log(`[ctn-approve] Reusing existing invitation for ${email}`);
    } else {
      // Get admin user ID to satisfy invited_by FK constraint
      // Look for the admin/owner account in user_roles
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .order("user_id")
        .limit(1)
        .maybeSingle();

      const invitedBy = adminRole?.user_id || null;

      // Create new invitation
      const insertData: Record<string, unknown> = {
        email:           email.toLowerCase(),
        role:            "user",
        commission_tier: commissionTier,
        token,
        expires_at:      expiresAt.toISOString(),
      };

      // Only set invited_by if we found a valid admin user ID
      if (invitedBy) insertData.invited_by = invitedBy;

      const { error: insertError } = await supabase
        .from("invitations")
        .insert(insertData);

      if (insertError) {
        console.error("[ctn-approve] Invitation insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create invitation", detail: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Fire send-email edge function ─────────────────────────────────────
    const inviteUrl = `https://app.crestwelltravels.com/auth?invite=${inviteToken}`;

    const emailRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to:       email,
          subject:  "You're invited to join the Crestwell Travel Network platform",
          template: "agent_invitation",
          data: {
            inviteUrl,
            inviterName:    "Crestwell Travel Network",
            agentFirstName: first_name || email.split("@")[0],
            expiresIn:      "7 days",
            plan,
            commissionTier: commissionTier.replace("tier_", "Tier "),
          },
        }),
      }
    );

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("[ctn-approve] send-email failed:", errText);
      // Still return success — invitation was created, email can be resent manually
    }

    console.log(`[ctn-approve] ✓ ${email} invited as agent | tier: ${commissionTier}`);

    return new Response(
      JSON.stringify({
        success:    true,
        email,
        tier:       commissionTier,
        invite_url: inviteUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ctn-approve] Error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
