import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = "The Crestwell Circle <circle@crestwellgetaways.com>";
const REPLY_TO = "hello@crestwellgetaways.com";
const UNSUBSCRIBE_MAILTO = "unsubscribe@crestwellgetaways.com";
const AGENT_PHONE = "888.508.6893";
const BRAND_NAVY = "#0a2540";
const BRAND_GOLD = "#c9a84c";

function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(inner: string, preheader = ""): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ec;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>` : ""}
    <div style="max-width:580px;margin:0 auto;background:#ffffff">
      <div style="background:${BRAND_NAVY};padding:28px 24px;text-align:center">
        <div style="color:${BRAND_GOLD};font-size:13px;letter-spacing:3px;text-transform:uppercase">The Crestwell Circle</div>
        <div style="color:#fff;font-size:22px;margin-top:6px">✦</div>
      </div>
      <div style="padding:32px 28px;line-height:1.55;font-size:15px">${inner}</div>
      <div style="background:#f6f3ec;padding:18px 24px;text-align:center;font-size:12px;color:#666;border-top:2px solid ${BRAND_GOLD}">
        Crestwell Travel Services · ${AGENT_PHONE}<br/>
        <a href="https://crestwellgetaways.com" style="color:${BRAND_NAVY}">crestwellgetaways.com</a>
      </div>
    </div></body></html>`;
}

async function sendResend(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };
  const toArr = Array.isArray(opts.to) ? opts.to : [opts.to];
  const primary = toArr[0];
  const unsubUrl = `https://crestwellgetaways.com/circle/unsubscribe?email=${encodeURIComponent(primary)}`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: toArr,
      reply_to: REPLY_TO,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? htmlToText(opts.html),
      headers: {
        "List-Unsubscribe": `<mailto:${UNSUBSCRIBE_MAILTO}?subject=unsubscribe>, <${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    return { ok: false, error: `Resend ${r.status}: ${text}` };
  }
  return { ok: true };
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const payload = await req.json();
    const kind = payload?.kind as string;

    if (kind === "welcome") {
      const { data: member, error } = await supabase
        .from("circle_members")
        .select("*")
        .eq("id", payload.member_id)
        .single();
      if (error || !member) return json({ error: "Member not found" }, 404);
      if (!member.email) return json({ error: "No email on member" }, 400);

      const name = member.name || "there";
      const founding = member.founding_member
        ? `<p style="background:#faf6e8;border-left:3px solid ${BRAND_GOLD};padding:12px 16px;margin:18px 0">
             <strong>You're a Founding Member ✦</strong> — one of only 20. Your tier is locked
             at the founder rate for life.
           </p>`
        : "";
      const inner = `
        <h1 style="color:${BRAND_NAVY};font-size:24px;margin:0 0 18px">Welcome, ${escapeHtml(name)}.</h1>
        <p>You're in. The Circle is our most personal way of staying close to the
        clients we travel best with — curated intel, quiet first-looks, and a direct
        line to your agent whenever the moment calls for one.</p>
        ${founding}
        <p>You'll hear from us soon with your first Port Intel briefing. In the meantime,
        just reply to this email if anything is on your mind.</p>
        <p style="margin-top:28px">Warmly,<br/><strong>The Crestwell Circle</strong></p>`;
      const send = await sendResend({
        to: member.email,
        subject: "Welcome to The Crestwell Circle ✦",
        html: shell(inner, "You're in. Here's what comes next."),
      });
      if (!send.ok) return json({ error: send.error }, 502);
      return json({ success: true });
    }

    if (kind === "briefing") {
      const { briefing_id, audience, subject, html } = payload;
      if (!briefing_id || !subject || !html) {
        return json({ error: "briefing_id, subject, html required" }, 400);
      }
      let query = supabase
        .from("circle_members")
        .select("email, name")
        .eq("status", "active")
        .not("email", "is", null);
      if (audience && audience !== "all") {
        query = query.eq("tier", audience);
      }
      const { data: members, error } = await query;
      if (error) return json({ error: error.message }, 500);
      const recipients = (members ?? [])
        .map((m) => m.email)
        .filter((e): e is string => !!e);

      let sent = 0;
      for (const email of recipients) {
        const r = await sendResend({
          to: email,
          subject,
          html: shell(html, subject),
        });
        if (r.ok) sent++;
      }
      await supabase
        .from("circle_briefings")
        .update({
          sent_at: new Date().toISOString(),
          sent_to_count: sent,
        })
        .eq("id", briefing_id);
      return json({ success: true, sent_to_count: sent });
    }

    if (kind === "founding_invitation") {
      const { subject, subject_variant, landing_url, recipients } = payload as {
        subject: string;
        subject_variant?: string;
        landing_url: string;
        recipients: Array<{ id?: string; email: string; name?: string }>;
      };
      if (!subject || !landing_url || !Array.isArray(recipients)) {
        return json({ error: "subject, landing_url, recipients required" }, 400);
      }

      let sent = 0;
      for (const r of recipients) {
        if (!r.email) continue;
        const name = r.name || "friend";
        const inner = `
          <h1 style="color:${BRAND_NAVY};font-size:24px;margin:0 0 18px">A quiet invitation, ${escapeHtml(name)}.</h1>
          <p>We're opening the doors to <strong>The Crestwell Circle</strong> — and
          we'd like you among the first 20 Founding Members.</p>
          <p>The Circle is where we share what we'd normally only tell our closest
          clients over a long lunch: where the rooms actually are right now, what's
          worth the splurge this season, and the moments we'd hate for you to miss.</p>
          <p style="background:#faf6e8;border-left:3px solid ${BRAND_GOLD};padding:12px 16px;margin:18px 0">
            <strong>Founding Members ✦</strong> are capped at 20, ever. The seat is
            yours for life at the founder rate, on the house for the first year.
          </p>
          <p style="text-align:center;margin:28px 0">
            <a href="${escapeHtml(landing_url)}"
               style="display:inline-block;background:${BRAND_GOLD};color:${BRAND_NAVY};
                      padding:14px 28px;border-radius:4px;text-decoration:none;
                      font-weight:600;letter-spacing:1px;text-transform:uppercase;
                      font-family:Arial,sans-serif;font-size:13px">
              Claim Your Seat
            </a>
          </p>
          <p>If now isn't your moment, just hit reply and let us know — no harm done.</p>
          <p style="margin-top:28px">With care,<br/><strong>The Crestwell Circle</strong></p>`;
        const res = await sendResend({
          to: r.email,
          subject,
          html: shell(inner, "A quiet invitation from Crestwell."),
        });
        if (res.ok) {
          sent++;
          await supabase.from("circle_invitations").insert({
            client_id: r.id ?? null,
            email: r.email,
            subject_variant: subject_variant ?? null,
            sent_at: new Date().toISOString(),
          });
        }
      }
      return json({ success: true, sent_count: sent });
    }

    return json({ error: `Unknown kind: ${kind}` }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});