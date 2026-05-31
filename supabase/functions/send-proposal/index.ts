// supabase/functions/send-proposal/index.ts
//
// Sends a client proposal: emails the /proposal/<token> link via Resend, then
// stamps the lead as sent (sets expiry + starts the follow-up sequence).
//
// Deploy:
//   supabase functions deploy send-proposal --no-verify-jwt --project-ref zbtnulzvwreqzbmxulpv
//
// Auth: agent secret (AGENT_SECRET or CW_AGENT_SECRET) for n8n/server,
//       OR a logged-in Supabase user JWT for the portal button.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE_URL       = Deno.env.get('PUBLIC_SITE_URL') ?? Deno.env.get('PORTAL_BASE_URL') ?? 'https://crestwellgetaways.com';
const AGENT_SECRET   = Deno.env.get('AGENT_SECRET') ?? Deno.env.get('CW_AGENT_SECRET') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM           = Deno.env.get('PROPOSAL_FROM_EMAIL') ?? 'Crestwell Travel <tim@crestwellgetaways.com>';
const EXPIRY_DAYS    = Number(Deno.env.get('PROPOSAL_EXPIRY_DAYS') ?? '7');

const ALLOWED_ORIGINS = [
  'https://app.crestwelltravels.com',
  'https://crestwellgetaways.com',
  'https://cts-agent-dash.lovable.app',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && (ALLOWED_ORIGINS.includes(origin) || /\.lovable\.app$/.test(new URL(origin).hostname))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-agent-secret, content-type, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emailHtml(firstName: string, destination: string, link: string, expires: Date): string {
  const expiryStr = expires.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f1ea;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:32px 36px;border-top:6px solid #c9a84c">
    <p style="font-family:Georgia,serif;color:#0b2545;font-size:14px;letter-spacing:1px;margin:0 0 4px;text-transform:uppercase">Crestwell Travel Services</p>
    <h1 style="font-family:Georgia,serif;color:#0b2545;margin:0 0 18px;font-size:24px">Your ${destination} proposal is ready</h1>
    <p style="color:#333;line-height:1.55;margin:0 0 14px">Hi ${firstName},</p>
    <p style="color:#333;line-height:1.55;margin:0 0 22px">I've put together your travel proposal. Tap below to review the options and approve the one you'd like &mdash; it only takes a moment, and I'll take it from there.</p>
    <div style="text-align:center;margin:24px 0 28px">
      <a href="${link}" style="display:inline-block;background:#0b2545;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:600;letter-spacing:.3px">View &amp; approve your proposal</a>
    </div>
    <p style="color:#666;font-size:13px;line-height:1.55;margin:0 0 6px">This pricing is held until <strong>${expiryStr}</strong>. If the button doesn't work, paste this link into your browser:</p>
    <p style="color:#0b2545;font-size:13px;word-break:break-all;margin:0 0 24px">${link}</p>
    <hr style="border:0;border-top:1px solid #eee;margin:24px 0">
    <p style="color:#555;margin:0">All the best,<br/><strong>Tim Crestwell</strong><br/>Crestwell Travel Services &middot; 888.508.6893</p>
  </div>
</body></html>`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

  // ---- Authorization: agent secret OR authenticated user ----
  let authorized = !!AGENT_SECRET && req.headers.get('x-agent-secret') === AGENT_SECRET;
  if (!authorized) {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (token && token !== anonKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data } = await userClient.auth.getUser();
      authorized = !!data.user;
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
  }

  // ---- Input ----
  let body: { lead_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400, headers });
  }
  const leadId = body.lead_id;
  if (!leadId) {
    return new Response(JSON.stringify({ error: 'missing_lead_id' }), { status: 400, headers });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // ---- Fetch + validate the lead ----
  const { data: lead, error: fetchErr } = await admin
    .from('quote_requests')
    .select('id, first_name, email, destination, proposal_draft, proposal_status, proposal_token')
    .eq('id', leadId)
    .single();

  if (fetchErr || !lead) {
    return new Response(JSON.stringify({ error: 'lead_not_found' }), { status: 404, headers });
  }
  if (!lead.proposal_draft || !lead.proposal_draft.trim()) {
    return new Response(JSON.stringify({ error: 'no_draft', message: 'Generate a proposal before sending.' }), { status: 422, headers });
  }
  if (!lead.email) {
    return new Response(JSON.stringify({ error: 'no_email', message: 'Lead has no email address.' }), { status: 422, headers });
  }
  if (['approved', 'converted'].includes(lead.proposal_status)) {
    return new Response(JSON.stringify({ error: 'already_decided', proposal_status: lead.proposal_status }), { status: 409, headers });
  }
  if (!lead.proposal_token) {
    return new Response(JSON.stringify({ error: 'missing_proposal_token' }), { status: 500, headers });
  }

  const link      = `${SITE_URL.replace(/\/$/, '')}/proposal/${lead.proposal_token}`;
  const sentAt    = new Date();
  const expiresAt = new Date(sentAt.getTime() + EXPIRY_DAYS * 86_400_000);

  // ---- Send email FIRST (so a failure never marks the row sent) ----
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [lead.email],
      subject: `Your ${lead.destination ?? 'travel'} proposal from Crestwell Travel`,
      html: emailHtml(esc(lead.first_name ?? 'there'), esc(lead.destination ?? 'your trip'), link, expiresAt),
    }),
  });

  if (!resendRes.ok) {
    const detail = await resendRes.text();
    console.error('Resend send failed:', resendRes.status, detail);
    return new Response(JSON.stringify({ error: 'email_failed', detail }), { status: 502, headers });
  }

  // ---- Stamp the lead ----
  const { error: updErr } = await admin
    .from('quote_requests')
    .update({
      proposal_status: 'sent',
      proposal_sent_at: sentAt.toISOString(),
      proposal_expires_at: expiresAt.toISOString(),
      sequence_started: true,
      sequence_paused: false,
      status: 'contacted',
    })
    .eq('id', leadId);

  if (updErr) {
    console.error('quote_requests update failed after send:', updErr);
    return new Response(JSON.stringify({ error: 'sent_but_update_failed', detail: updErr.message, link }), { status: 500, headers });
  }

  return new Response(JSON.stringify({ ok: true, link, expires_at: expiresAt.toISOString() }), { headers });
});