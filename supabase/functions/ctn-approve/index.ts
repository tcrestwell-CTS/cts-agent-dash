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

// Fetches the two onboarding PDFs from Supabase Storage and emails them.
// Shared by: new-invitation flow, existing-user flow, and docs_only mode
// (fired by the Stripe webhook once payment confirms for an already-approved applicant).
async function sendOnboardingDocs(
  supabase: ReturnType<typeof createClient>,
  email: string,
  firstName: string | undefined
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const docs = [
      { filename: "CTN_IC_Agent_Onboarding_Guide_2026.pdf", path: "onboarding-guide.pdf" },
      { filename: "CTN_Agent_Setup_Guide_2026.pdf",          path: "setup-guide.pdf" },
    ];

    const attachments: Array<{ filename: string; content: string }> = [];

    for (const doc of docs) {
      const fileRes = await fetch(
        `${supabaseUrl}/storage/v1/object/agent-documents/${doc.path}`,
        { headers: { "Authorization": `Bearer ${serviceKey}`, "apikey": serviceKey } }
      );
      if (fileRes.ok) {
        const arrayBuffer = await fileRes.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        const b64 = btoa(uint8.reduce((data, byte) => data + String.fromCharCode(byte), ""));
        attachments.push({ filename: doc.filename, content: b64 });
      } else {
        console.warn(`[ctn-approve] Could not load ${doc.path}: ${fileRes.status}`);
      }
    }

    // BUG FIX: this previously did `if (attachments.length === 0) return;`
    // — meaning if the PDFs weren't in the bucket yet (e.g. never uploaded),
    // the function went completely silent: no email, no error surfaced
    // anywhere, no record that anything was even attempted. Confirmed this
    // happened for at least one real agent whose payment/approval completed
    // with zero onboarding email ever sent. Now it always sends something —
    // the honest version of the email when attachments are missing, rather
    // than claiming documents are attached when they aren't.
    const allDocsFound = attachments.length === docs.length;
    const missingDocs = docs.filter((_, i) => !attachments.some((a) => a.filename === docs[i].filename));
    if (!allDocsFound) {
      console.warn(
        `[ctn-approve] Sending onboarding email WITHOUT full attachments for ${email} — missing: ${missingDocs.map(d => d.path).join(", ")}. Upload these to the agent-documents bucket.`,
      );
    }

    const bodyIntro = allDocsFound
      ? `Your subscription is confirmed! Attached are two important documents to help you get started:`
      : `Your subscription is confirmed! Your onboarding documents are being finalized and will follow in a separate email shortly — in the meantime, here's what to expect:`;

    const docsRes = await fetch(
      `${supabaseUrl}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to:       email,
          subject:  "Welcome to Crestwell Travel Network — Your Onboarding Documents",
          template: "custom",
          customHtml: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
              <div style="background:#1a2744;padding:28px 32px;border-radius:10px 10px 0 0;">
                <h2 style="color:#c9a84c;margin:0;">Your Onboarding Documents</h2>
                <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">Crestwell Travel Network · Host Agency</p>
              </div>
              <div style="padding:28px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
                <p style="font-size:14px;line-height:1.7;color:#374151;">Hi ${firstName || "there"},</p>
                <p style="font-size:14px;line-height:1.7;color:#374151;">
                  ${bodyIntro}
                </p>
                <ul style="font-size:13px;line-height:2;color:#475569;padding-left:20px;">
                  <li><strong>IC Agent Onboarding Guide</strong> — Your complete reference for policies, commission structure, compliance, and support</li>
                  <li><strong>New Agent Setup Guide</strong> — Step-by-step platform walkthrough to get you up and running quickly</li>
                </ul>
                <p style="font-size:14px;line-height:1.7;color:#374151;">
                  Once you activate your account, start with the <strong>Platform Basics</strong> training module.
                </p>
                <p style="font-size:13px;color:#6b7280;margin-top:24px;">
                  Questions? Email us at <a href="mailto:agents@crestwellgetaways.com" style="color:#c9a84c;">agents@crestwellgetaways.com</a>
                  or call <a href="tel:8885086893" style="color:#c9a84c;">888.508.6893</a>.
                </p>
                <p style="font-size:14px;margin-top:20px;">Welcome aboard,<br/><strong>Crestwell Travel Network</strong></p>
              </div>
            </div>
          `,
          attachments,
        }),
      }
    );

    if (!docsRes.ok) {
      console.error("[ctn-approve] Document email failed:", await docsRes.text());
    } else {
      console.log("[ctn-approve] ✓ Onboarding documents sent to", email);
    }
  } catch (docErr) {
    console.error("[ctn-approve] Document send error:", docErr);
  }
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
    const { email, first_name, plan, application_id, skip_docs, docs_only } = body;
    // skip_docs: caller confirms payment not yet received — invite only, no docs.
    // docs_only: payment just confirmed for an already-approved applicant —
    //            send the onboarding docs email now, skip invite/role setup.

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

      if (!skip_docs) {
        await sendOnboardingDocs(supabase, email, first_name);
      }

      return new Response(
        JSON.stringify({
          success: true, email, tier: commissionTier, invite_url: inviteUrl,
          note: "existing_user_role_updated",
          docs_sent: !skip_docs,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── docs_only mode: payment just confirmed for an already-approved
    //    applicant. Skip invite/role setup entirely, just send the docs. ────
    if (docs_only) {
      await sendOnboardingDocs(supabase, email, first_name);
      return new Response(
        JSON.stringify({ success: true, email, docs_sent: true, note: "docs_only" }),
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
    }

    // ── Send onboarding documents ──────────────────────────────────────────
    if (!skip_docs) {
      await sendOnboardingDocs(supabase, email, first_name);
    } else {
      console.log(`[ctn-approve] skip_docs=true for ${email} — docs will send once payment is confirmed`);
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
