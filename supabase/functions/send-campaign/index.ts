// =============================================================================
// supabase/functions/send-campaign/index.ts
// Invoked from CRM UI by authenticated admin to send a draft campaign.
// =============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.1";

const ALLOWED_ORIGINS = [
  "https://app.crestwelltravels.com",
  "https://cts-agent-dash.lovable.app",
  "https://crestwellgetaways.com",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const HMAC_SECRET = Deno.env.get("UNSUBSCRIBE_HMAC_SECRET")!;
const PORTAL_BASE = Deno.env.get("PORTAL_BASE_URL") ?? "https://app.crestwelltravels.com";
const FROM_ADDRESS =
  Deno.env.get("CAMPAIGN_FROM_ADDRESS") ??
  "Crestwell Travels <hello@crestwelltravels.com>";
const PHYSICAL_ADDRESS =
  Deno.env.get("CAMPAIGN_PHYSICAL_ADDRESS") ??
  "Crestwell Travel Services, PO Box, USA";

const resend = new Resend(RESEND_API_KEY);

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function signUnsubscribe(email: string, campaignId: string): Promise<string> {
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

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

function wrapHtml(opts: {
  bodyHtml: string;
  unsubscribeUrl: string;
  physicalAddress: string;
}): string {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px;">
          ${opts.bodyHtml}
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #eaeaea;font-size:12px;color:#666666;line-height:1.5;">
          <p style="margin:0 0 8px;">${opts.physicalAddress}</p>
          <p style="margin:0;">
            You're receiving this because you're a Crestwell Travels client or subscriber.
            <br/>
            <a href="${opts.unsubscribeUrl}" style="color:#666666;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, origin);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // Verify caller
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401, origin);

  // Require admin / office_admin
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const isAdmin = (roles ?? []).some(
    (r) => r.role === "admin" || r.role === "office_admin",
  );
  if (!isAdmin) return json({ error: "Forbidden" }, 403, origin);

  let body: { campaignId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, origin);
  }
  const campaignId = body.campaignId;
  if (!campaignId) return json({ error: "campaignId required" }, 400, origin);

  // Use service role for all subsequent ops
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: campaign, error: cErr } = await admin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404, origin);
    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return json({ error: `Cannot send campaign in status ${campaign.status}` }, 400, origin);
    }

    await admin
      .from("campaigns")
      .update({ status: "sending" })
      .eq("id", campaignId);

    const { data: recipients, error: rErr } = await admin
      .from("campaign_recipients")
      .select("id, email, merge_data")
      .eq("campaign_id", campaignId)
      .eq("status", "queued");
    if (rErr) throw rErr;

    // Filter against suppressions
    const emails = (recipients ?? []).map((r) => r.email.toLowerCase());
    const { data: suppressed } = await admin
      .from("email_suppressions")
      .select("email")
      .in("email", emails);
    const blocked = new Set((suppressed ?? []).map((s) => s.email.toLowerCase()));

    let sentCount = 0;
    let failedCount = 0;

    for (const rec of recipients ?? []) {
      if (blocked.has(rec.email.toLowerCase())) {
        await admin
          .from("campaign_recipients")
          .update({ status: "suppressed" })
          .eq("id", rec.id);
        continue;
      }

      const token = await signUnsubscribe(rec.email, campaignId);
      const unsubscribeUrl = `${PORTAL_BASE}/unsubscribe?e=${encodeURIComponent(rec.email)}&c=${campaignId}&t=${token}`;

      const md = (rec.merge_data ?? {}) as Record<string, string>;
      const mergeVars: Record<string, string> = {
        email: rec.email,
        first_name: md.first_name ?? "",
        last_name: md.last_name ?? "",
        contact_name: md.contact_name ?? `${md.first_name ?? ""} ${md.last_name ?? ""}`.trim(),
        ...md,
      };

      const subject = renderTemplate(campaign.subject ?? "", mergeVars);
      const innerHtml = renderTemplate(campaign.body_html ?? "", mergeVars);
      const html = wrapHtml({
        bodyHtml: innerHtml,
        unsubscribeUrl,
        physicalAddress: PHYSICAL_ADDRESS,
      });

      try {
        const { data: sent, error: sendErr } = await resend.emails.send({
          from: FROM_ADDRESS,
          to: [rec.email],
          subject,
          html,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          tags: [{ name: "campaign_id", value: campaignId }],
        });
        if (sendErr) throw sendErr;

        await admin
          .from("campaign_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_id: sent?.id ?? null,
          })
          .eq("id", rec.id);
        sentCount++;
      } catch (err) {
        failedCount++;
        await admin
          .from("campaign_recipients")
          .update({
            status: "failed",
            error_message: (err as Error).message?.slice(0, 500) ?? "send failed",
          })
          .eq("id", rec.id);
      }
    }

    await admin
      .from("campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        total_sent: sentCount,
        total_suppressed: blocked.size,
      })
      .eq("id", campaignId);

    return json(
      {
        ok: true,
        campaignId,
        total: recipients?.length ?? 0,
        sent: sentCount,
        failed: failedCount,
        suppressed: blocked.size,
      },
      200,
      origin,
    );
  } catch (err) {
    console.error("send-campaign error:", err);
    await admin
      .from("campaigns")
      .update({ status: "failed" })
      .eq("id", campaignId);
    return json({ error: (err as Error).message }, 500, origin);
  }
});