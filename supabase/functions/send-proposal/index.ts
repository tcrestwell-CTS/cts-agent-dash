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

interface EmailOptions {
  firstName: string;
  destination: string;
  departDate: string | null;
  coverImageUrl: string | null;
  tripSummary: string | null;
  link: string;
  expires: Date;
  advisorName: string;
  advisorTitle: string;
  advisorPhone: string;
  agencyName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  advisorAvatarUrl: string | null;
}

function emailHtml(opts: EmailOptions): string {
  const {
    firstName, destination, departDate, coverImageUrl, tripSummary,
    link, expires, advisorName, advisorTitle, advisorPhone,
    agencyName, primaryColor, accentColor, logoUrl, advisorAvatarUrl,
  } = opts;

  const expiryStr = expires.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const departStr = departDate
    ? new Date(departDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const coverBlock = coverImageUrl
    ? `<div style="margin:0 0 0 0;line-height:0">
         <img src="${coverImageUrl}" alt="${esc(destination)}" width="600"
              style="width:100%;max-width:600px;height:240px;object-fit:cover;display:block" />
       </div>`
    : '';

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${esc(agencyName)}" height="36"
            style="height:36px;max-width:180px;object-fit:contain;display:block;margin-bottom:6px" />`
    : `<p style="font-family:Georgia,serif;color:${primaryColor};font-size:13px;letter-spacing:1px;
                margin:0 0 6px;text-transform:uppercase;font-weight:700">${esc(agencyName)}</p>`;

  const summaryBlock = tripSummary
    ? `<p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 20px;
                border-left:3px solid ${accentColor};padding-left:14px;font-style:italic">
         ${esc(tripSummary)}
       </p>`
    : '';

  const dateChip = departStr
    ? `<span style="display:inline-block;background:${accentColor}20;color:${primaryColor};
                   border:1px solid ${accentColor}50;border-radius:20px;
                   padding:4px 12px;font-size:13px;font-weight:600;margin:0 0 20px">
         &#128197;&nbsp; Departing ${departStr}
       </span><br/>`
    : '';

  const avatarBlock = advisorAvatarUrl
    ? `<img src="${advisorAvatarUrl}" alt="${esc(advisorName)}" width="44" height="44"
            style="width:44px;height:44px;border-radius:50%;object-fit:cover;
                   display:inline-block;vertical-align:middle;margin-right:12px" />`
    : `<div style="width:44px;height:44px;border-radius:50%;background:${primaryColor};
                  display:inline-flex;align-items:center;justify-content:center;
                  color:#fff;font-weight:700;font-size:16px;vertical-align:middle;
                  margin-right:12px;line-height:44px;text-align:center">
         ${esc(advisorName.charAt(0))}
       </div>`;

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your ${esc(destination)} proposal</title>
</head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Helvetica Neue',Arial,sans-serif">

<div style="max-width:600px;margin:24px auto;background:#ffffff;
            border-radius:8px;overflow:hidden;
            box-shadow:0 2px 16px rgba(0,0,0,0.08)">

  <!-- Cover image -->
  ${coverBlock}

  <!-- Header -->
  <div style="background:${primaryColor};padding:24px 32px 20px">
    ${logoBlock}
    <h1 style="font-family:Georgia,serif;color:#ffffff;margin:0;
               font-size:26px;line-height:1.25;font-weight:700">
      Your ${esc(destination)} proposal is ready
    </h1>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px 24px">

    ${dateChip}

    <p style="color:#222;font-size:16px;line-height:1.6;margin:0 0 14px">
      Hi ${esc(firstName)},
    </p>
    <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 20px">
      I've put together your personalized travel proposal. Review your options, ask any questions, 
      and approve the itinerary you'd like to move forward with &mdash; it only takes a moment.
    </p>

    ${summaryBlock}

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0 24px">
      <a href="${link}"
         style="display:inline-block;background:${accentColor};color:#ffffff;
                text-decoration:none;padding:15px 36px;border-radius:6px;
                font-weight:700;font-size:16px;letter-spacing:.3px;
                box-shadow:0 2px 8px ${accentColor}60">
        View &amp; approve your proposal &rarr;
      </a>
    </div>

    <p style="color:#888;font-size:13px;line-height:1.5;margin:0 0 6px;text-align:center">
      Pricing held until <strong style="color:#555">${expiryStr}</strong>
    </p>
    <p style="color:#aaa;font-size:12px;text-align:center;word-break:break-all;margin:0 0 28px">
      ${link}
    </p>

    <hr style="border:0;border-top:1px solid #eee;margin:0 0 24px" />

    <!-- Advisor card -->
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%">
      <tr>
        <td style="vertical-align:middle;width:56px">${avatarBlock}</td>
        <td style="vertical-align:middle">
          <p style="margin:0;font-weight:700;color:#222;font-size:14px">${esc(advisorName)}</p>
          <p style="margin:2px 0 0;color:#666;font-size:13px">${esc(advisorTitle)} &middot; ${esc(agencyName)}</p>
          <p style="margin:4px 0 0;font-size:13px">
            <a href="tel:${esc(advisorPhone)}" style="color:${primaryColor};text-decoration:none;font-weight:600">
              ${esc(advisorPhone)}
            </a>
          </p>
        </td>
      </tr>
    </table>

  </div>

  <!-- Footer -->
  <div style="background:#f8f6f2;padding:16px 32px;border-top:1px solid #eee;text-align:center">
    <p style="margin:0;color:#999;font-size:12px;line-height:1.6">
      You received this because you requested a travel quote from ${esc(agencyName)}.<br/>
      Questions? Reply to this email or call ${esc(advisorPhone)}.
    </p>
  </div>

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

  // ---- Fetch + validate the lead (incl. advisor & branding for rich email) ----
  const { data: lead, error: fetchErr } = await admin
    .from('quote_requests')
    .select(`
      id, first_name, email, destination, proposal_draft, proposal_status, proposal_token,
      cover_image_url, depart_date, trip_summary,
      profiles (
        full_name, job_title, phone, avatar_url,
        agency_branding (
          agency_name, logo_url, primary_color, accent_color
        )
      )
    `)
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

  // ---- Resolve advisor & branding (graceful fallbacks) ----
  const profile  = (lead as any).profiles ?? {};
  const branding = profile.agency_branding ?? {};

  const emailOpts: EmailOptions = {
    firstName:       esc(lead.first_name ?? 'there'),
    destination:     esc(lead.destination ?? 'your trip'),
    departDate:      (lead as any).depart_date ?? null,
    coverImageUrl:   (lead as any).cover_image_url ?? null,
    tripSummary:     (lead as any).trip_summary ?? null,
    link,
    expires:         expiresAt,
    advisorName:     esc(profile.full_name ?? 'Tim Crestwell'),
    advisorTitle:    esc(profile.job_title ?? 'Travel Advisor'),
    advisorPhone:    esc(profile.phone ?? '888.508.6893'),
    agencyName:      esc(branding.agency_name ?? 'Crestwell Travel Services'),
    primaryColor:    branding.primary_color ?? '#0b2545',
    accentColor:     branding.accent_color ?? '#c9a84c',
    logoUrl:         branding.logo_url ?? null,
    advisorAvatarUrl: profile.avatar_url ?? null,
  };

  // ---- Send email FIRST (so a failure never marks the row sent) ----
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to:   [lead.email],
      subject: `Your ${esc(lead.destination ?? 'travel')} proposal from ${esc(branding.agency_name ?? 'Crestwell Travel')}`,
      html: emailHtml(emailOpts),
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
