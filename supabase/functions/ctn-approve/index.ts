// supabase/functions/ctn-approve/index.ts
// Called by CTN-Hosting admin dashboard when approving an agent application
// Accepts: { email, first_name, plan, reviewer_notes, secret }
// Does:
//   1. Validates the CTN agent secret
//   2. Creates invitation row in invitations table
//   3. Fires send-email edge function with agent_invitation template
// The service role key never leaves this environment

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const responseHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": "authorization, content-type, x-agent-secret",
  "Content-Type": "application/json",
};

const PLAN_TO_TIER: Record<string, string> = {
  starter:      "tier_1",
  professional: "tier_2",
  elite:        "tier_3",
  unsure:       "tier_1",
};

const PLAN_DETAILS: Record<string, { name: string; amount: number }> = {
  starter: { name: "Starter Monthly", amount: 29 },
  professional: { name: "Professional Monthly", amount: 49 },
  elite: { name: "Elite Monthly", amount: 99 },
  unsure: { name: "Starter Monthly", amount: 29 },
};

const RequestSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.trim().toLowerCase()),
  first_name: z.string().trim().min(1).max(100).optional(),
  plan: z.enum(["starter", "professional", "elite", "unsure"]),
  application_id: z.string().uuid().optional(),
  stripe_event_id: z.string().trim().max(255).optional(),
  stripe_customer_id: z.string().trim().max(255).optional(),
  stripe_checkout_session_id: z.string().trim().max(255).optional(),
  stripe_subscription_id: z.string().trim().max(255).optional(),
  payment_status: z.string().trim().max(50).optional(),
  match_method: z.string().trim().max(50).optional(),
  skip_docs: z.boolean().optional().default(false),
  docs_only: z.boolean().optional().default(false),
});

type ApprovalInput = z.infer<typeof RequestSchema>;

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
): Promise<boolean> {
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
      return false;
    } else {
      console.log("[ctn-approve] ✓ Onboarding documents sent to", email);
      return true;
    }
  } catch (docErr) {
    console.error("[ctn-approve] Document send error:", docErr);
    return false;
  }
}

// ── Cross-project sync: ic_onboarding lives in CTN's Supabase project
// (mouwwpftjlumhpntseyz), a completely separate project from this one.
// Once an agent's platform account exists here, mark their ic_onboarding
// row as synced so the two systems don't drift out of sync silently.
// Requires CTN_SUPABASE_URL + CTN_SUPABASE_ANON_KEY to be set as secrets
// on THIS project — best-effort: logs and continues on failure rather
// than failing the whole approval over a cross-project sync issue.
async function notifyIcOnboardingSynced(email: string): Promise<void> {
  const ctnUrl = Deno.env.get("CTN_SUPABASE_URL");
  const ctnKey = Deno.env.get("CTN_SUPABASE_ANON_KEY");
  if (!ctnUrl || !ctnKey) {
    console.warn("[ctn-approve] CTN_SUPABASE_URL/CTN_SUPABASE_ANON_KEY not configured — skipping ic_onboarding sync.");
    return;
  }
  try {
    const res = await fetch(
      `${ctnUrl}/rest/v1/ic_onboarding?email=eq.${encodeURIComponent(email.toLowerCase())}`,
      {
        method: "PATCH",
        headers: {
          apikey: ctnKey,
          Authorization: `Bearer ${ctnKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ agent_dash_synced_at: new Date().toISOString() }),
      },
    );
    if (!res.ok) {
      console.warn(`[ctn-approve] ic_onboarding sync failed (${res.status}) for ${email}: ${await res.text()}`);
    }
  } catch (err) {
    console.warn(`[ctn-approve] ic_onboarding sync threw for ${email}:`, err);
  }
}

async function startApprovalLog(
  supabase: ReturnType<typeof createClient>,
  input: ApprovalInput,
  actionType: "invite" | "existing_user" | "docs_only" | "payment_pending",
) {
  const lookup = input.stripe_event_id
    ? supabase.from("ctn_approval_log").select("id, attempt_count").eq("stripe_event_id", input.stripe_event_id)
    : input.application_id && input.stripe_subscription_id
      ? supabase.from("ctn_approval_log").select("id, attempt_count")
          .eq("application_id", input.application_id)
          .eq("stripe_subscription_id", input.stripe_subscription_id)
          .eq("action_type", actionType)
      : null;

  const { data: prior } = lookup ? await lookup.maybeSingle() : { data: null };
  const record = {
    application_id: input.application_id || null,
    email: input.email,
    action_type: actionType,
    stripe_event_id: input.stripe_event_id || null,
    stripe_customer_id: input.stripe_customer_id || null,
    stripe_checkout_session_id: input.stripe_checkout_session_id || null,
    stripe_subscription_id: input.stripe_subscription_id || null,
    payment_status: input.payment_status || null,
    match_method: input.match_method || (input.application_id ? "application_id" : "email"),
    status: actionType === "payment_pending" ? "pending_payment" : "processing",
    attempt_count: (prior?.attempt_count || 0) + 1,
    error: null,
  };

  if (prior?.id) {
    const { error } = await supabase.from("ctn_approval_log").update(record).eq("id", prior.id);
    if (error) throw new Error(`Failed to update approval log: ${error.message}`);
    return prior.id;
  }

  const { data, error } = await supabase.from("ctn_approval_log").insert(record).select("id").single();
  if (error) throw new Error(`Failed to create approval log: ${error.message}`);
  return data.id as string;
}

async function finishApprovalLog(
  supabase: ReturnType<typeof createClient>,
  logId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase.from("ctn_approval_log").update(values).eq("id", logId);
  if (error) console.error("[ctn-approve] approval log update failed:", error.message);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: responseHeaders });
  }

  // Auth: accept either x-agent-secret OR Authorization Bearer with service role key
  const agentSecret = req.headers.get("x-agent-secret");
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.replace("Bearer ", "").trim();

  const validSecrets = [
    Deno.env.get("CTN_APPROVE_SECRET"),
    Deno.env.get("CW_AGENT_SECRET"),
  ].filter(Boolean);

  const providedToken = agentSecret || bearerToken;

  if (!providedToken || !validSecrets.includes(providedToken)) {
    console.error("[ctn-approve] Authorization failed");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: responseHeaders,
    });
  }

  let supabase: ReturnType<typeof createClient> | null = null;
  let approvalLogId: string | null = null;
  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: responseHeaders,
      });
    }
    const input = parsed.data;
    const { email, first_name, plan, skip_docs, docs_only } = input;
    // skip_docs: caller confirms payment not yet received — invite only, no docs.
    // docs_only: payment just confirmed for an already-approved applicant —
    //            send the onboarding docs email now, skip invite/role setup.

    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const normalizedPaymentStatus = input.payment_status?.toLowerCase();
    const hasStripePaymentContext = Boolean(input.stripe_checkout_session_id || input.stripe_subscription_id || input.stripe_event_id);
    if (hasStripePaymentContext && normalizedPaymentStatus && !["paid", "succeeded"].includes(normalizedPaymentStatus)) {
      approvalLogId = await startApprovalLog(supabase, input, "payment_pending");
      await finishApprovalLog(supabase, approvalLogId, {
        status: "pending_payment",
        error: `Payment is ${normalizedPaymentStatus}; account access was not activated`,
      });
      return new Response(JSON.stringify({ success: false, pending_payment: true, payment_status: normalizedPaymentStatus }), {
        status: 202,
        headers: responseHeaders,
      });
    }

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
      approvalLogId = await startApprovalLog(supabase, input, "existing_user");
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
      if (profileErr) throw new Error(`Profile upsert failed: ${profileErr.message}`);

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
        if (roleErr) throw new Error(`Role assignment failed: ${roleErr.message}`);
      }

      if (input.stripe_subscription_id || input.stripe_customer_id) {
        const planDetails = PLAN_DETAILS[plan];
        const { error: subscriptionError } = await supabase.from("agent_subscriptions").upsert({
          agent_user_id: existingUser.id,
          plan_name: planDetails.name,
          amount: planDetails.amount,
          billing_interval: "monthly",
          status: "active",
          started_on: new Date().toISOString().slice(0, 10),
          stripe_customer_id: input.stripe_customer_id || null,
          stripe_subscription_id: input.stripe_subscription_id || null,
          notes: input.application_id ? `CTN application ${input.application_id}` : "CTN approval",
        }, { onConflict: "agent_user_id" });
        if (subscriptionError) throw new Error(`Subscription mapping failed: ${subscriptionError.message}`);
      }

      const inviteUrl = `https://app.crestwelltravels.com/auth`;

      const docsSent = skip_docs ? false : await sendOnboardingDocs(supabase, email, first_name);

      await notifyIcOnboardingSynced(email);
      await finishApprovalLog(supabase, approvalLogId, {
        status: "succeeded",
        agent_user_id: existingUser.id,
        completed_at: new Date().toISOString(),
        details: { docs_sent: docsSent, docs_skipped: skip_docs },
      });
      return new Response(
        JSON.stringify({
          success: true, email, tier: commissionTier, invite_url: inviteUrl,
          note: "existing_user_role_updated",
          docs_sent: docsSent,
        }),
        { status: 200, headers: responseHeaders }
      );
    }

    // ── docs_only mode: payment just confirmed for an already-approved
    //    applicant. Skip invite/role setup entirely, just send the docs. ────
    if (docs_only) {
      approvalLogId = await startApprovalLog(supabase, input, "docs_only");
      const docsSent = await sendOnboardingDocs(supabase, email, first_name);
      if (!docsSent) throw new Error("Onboarding email failed and is eligible for retry");
      await notifyIcOnboardingSynced(email);
      await finishApprovalLog(supabase, approvalLogId, {
        status: "succeeded",
        completed_at: new Date().toISOString(),
        details: { docs_sent: true },
      });
      return new Response(
        JSON.stringify({ success: true, email, docs_sent: true, note: "docs_only" }),
        { status: 200, headers: responseHeaders }
      );
    }

    // ── Check for existing pending invitation ─────────────────────────────
    approvalLogId = await startApprovalLog(supabase, input, "invite");
    const { data: existing } = await supabase
      .from("invitations")
      .select("id, token")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    let inviteToken = token;

    if (existing) {
      // Reuse existing token, extend expiry
      const { error: extendError } = await supabase
        .from("invitations")
        .update({ expires_at: expiresAt.toISOString() })
        .eq("id", existing.id);
      if (extendError) throw new Error(`Invitation extension failed: ${extendError.message}`);
      inviteToken = existing.token;
      await finishApprovalLog(supabase, approvalLogId, { invitation_id: existing.id });
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

      const { data: insertedInvitation, error: insertError } = await supabase
        .from("invitations")
        .insert(insertData)
        .select("id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          const { data: concurrentInvite, error: concurrentError } = await supabase
            .from("invitations")
            .select("id, token")
            .eq("email", email)
            .eq("status", "pending")
            .single();
          if (concurrentError || !concurrentInvite) throw new Error(`Invitation creation failed: ${insertError.message}`);
          inviteToken = concurrentInvite.token;
        } else {
          throw new Error(`Invitation creation failed: ${insertError.message}`);
        }
      } else if (insertedInvitation) {
        await finishApprovalLog(supabase, approvalLogId, { invitation_id: insertedInvitation.id });
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
      throw new Error(`Invitation email failed: ${errText}`);
    }

    // ── Send onboarding documents ──────────────────────────────────────────
    let docsSent = false;
    if (!skip_docs) {
      docsSent = await sendOnboardingDocs(supabase, email, first_name);
    } else {
      console.log(`[ctn-approve] skip_docs=true for ${email} — docs will send once payment is confirmed`);
    }

    console.log(`[ctn-approve] ✓ ${email} invited as agent | tier: ${commissionTier}`);
    await notifyIcOnboardingSynced(email);
    await finishApprovalLog(supabase, approvalLogId, {
      status: "succeeded",
      completed_at: new Date().toISOString(),
      details: { docs_sent: docsSent, docs_skipped: skip_docs },
    });

    return new Response(
      JSON.stringify({
        success:    true,
        email,
        tier:       commissionTier,
        invite_url: inviteUrl,
      }),
        { status: 200, headers: responseHeaders }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ctn-approve] Error:", msg);
    if (supabase && approvalLogId) {
      await finishApprovalLog(supabase, approvalLogId, { status: "failed", error: msg });
    }
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: msg }),
      { status: 500, headers: responseHeaders }
    );
  }
});
