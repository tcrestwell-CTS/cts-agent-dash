// ASHLEY — Agent 4: Quote Generator
// supabase/functions/ashley/index.ts
// Called when Tim approves a Terrance proposal.
// Generates a branded Word doc quote and emails it to the client.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPA_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_SVC      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY    = Deno.env.get('RESEND_API_KEY') ?? '';
const AGENT_SECRET  = Deno.env.get('CW_AGENT_SECRET') ?? '';
const SITE_URL      = 'https://crestwellgetaways.com';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // Auth check
  const secret = req.headers.get('x-agent-secret') || '';
  if (secret !== AGENT_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
  }

  const body = await req.json().catch(() => ({}));
  const { lead_id } = body;
  if (!lead_id) return new Response(JSON.stringify({ error: 'lead_id required' }), { status: 400, headers: CORS });

  const db = createClient(SUPA_URL, SUPA_SVC);

  // Fetch lead
  const { data: lead, error } = await db
    .from('quote_requests').select('*').eq('id', lead_id).single();
  if (error || !lead) return new Response(JSON.stringify({ error: 'Lead not found' }), { status: 404, headers: CORS });

  const proposal: string = lead.proposal_draft ?? '';
  if (!proposal) return new Response(JSON.stringify({ error: 'No proposal draft found. Run Terrance first.' }), { status: 400, headers: CORS });

  // Parse proposal into structured sections
  const sections = parseProposal(proposal);
  const clientName = `${lead.first_name} ${lead.last_name}`.trim();
  const destination = lead.destination || 'your destination';
  const tripType = lead.trip_type || 'Vacation';
  const budget = lead.budget || '';
  const travelers = lead.travelers_adults ? `${lead.travelers_adults} adult(s)` : '';

  // Generate HTML email (rich branded quote)
  const html = buildQuoteEmail({
    clientName, destination, tripType, budget, travelers,
    sections, lead, siteUrl: SITE_URL,
  });

  // Send to client
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Tim Crestwell <info@crestwellgetaways.com>',
      to: [lead.email],
      subject: `Your ${destination} Travel Quote — Crestwell Travel Services`,
      html,
    }),
  });

  const emailData = await emailRes.json().catch(() => ({}));
  const emailOk = emailRes.ok;

  // Update DB
  await db.from('quote_requests').update({
    proposal_status: emailOk ? 'quote_sent' : 'quote_failed',
    ai_processed_at: new Date().toISOString(),
  }).eq('id', lead_id);

  // Notify Tim
  if (emailOk) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Crestwell AI <noreply@crestwellgetaways.com>',
        to: ['tcrestwell@crestwellgetaways.com'],
        subject: `✅ Ashley sent quote to ${clientName}`,
        html: `<p>Ashley (Agent 4) successfully sent the branded quote to <strong>${clientName}</strong> at <strong>${lead.email}</strong>.</p><p><strong>Destination:</strong> ${destination}<br><strong>Budget:</strong> ${budget}</p>`,
      }),
    });
  }

  return new Response(JSON.stringify({
    success: emailOk,
    lead_id, client: clientName, email: lead.email,
    email_id: emailData?.id,
    agent: 'Ashley',
  }), { status: 200, headers: CORS });
});

// ── PROPOSAL PARSER ────────────────────────────────────────────────────────
function parseProposal(text: string) {
  const lines = text.split('\n');
  const options: { letter: string; title: string; ship: string; price: string; desc: string }[] = [];
  const itinerary: { day: string; port: string; activity: string }[] = [];
  const inclusions: string[] = [];
  const checklist: string[] = [];
  let currentSection = '';

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;

    if (l.startsWith('### Option')) {
      currentSection = 'option';
      const match = l.match(/### Option ([A-C]) — (.+)/);
      if (match) options.push({ letter: match[1], title: match[2], ship: '', price: '', desc: '' });
    } else if (currentSection === 'option' && options.length > 0) {
      const last = options[options.length - 1];
      if (l.startsWith('**') && !last.ship) {
        const parts = l.replace(/\*\*/g, '').split('|');
        last.ship = parts.slice(0, -1).map(p => p.trim()).join(' | ');
        const priceMatch = l.match(/Est\. \$[\d,–]+\s*per person/);
        if (priceMatch) last.price = priceMatch[0].replace('Est. ', '');
      } else if (!l.startsWith('#') && !l.startsWith('|') && !l.startsWith('-')) {
        last.desc += (last.desc ? ' ' : '') + l;
      }
    }

    if (l.startsWith('| Day')) { currentSection = 'itin'; continue; }
    if (currentSection === 'itin' && l.startsWith('|') && !l.startsWith('|---')) {
      const parts = l.split('|').filter(p => p.trim()).map(p => p.trim());
      if (parts.length >= 2) itinerary.push({ day: parts[0], port: parts[1], activity: parts[2] || '' });
    }

    if (l.startsWith('## Key Inclusions') || l.startsWith('## What')) currentSection = 'inclusions';
    if (currentSection === 'inclusions' && l.startsWith('- **')) {
      inclusions.push(l.replace(/^- \*\*/, '').replace(/\*\*/, ': '));
    }

    if (l.startsWith('## Tim')) currentSection = 'checklist';
    if (currentSection === 'checklist' && l.startsWith('- [')) {
      checklist.push(l.replace(/^- \[ \] /, ''));
    }
  }

  return { options, itinerary, inclusions, checklist };
}

// ── EMAIL BUILDER ──────────────────────────────────────────────────────────
function buildQuoteEmail({ clientName, destination, tripType, budget, travelers, sections, lead, siteUrl }: any) {
  const { options, itinerary, inclusions } = sections;

  const optionColors = ['#0D1B2A', '#2D6A4F', '#534AB7'];
  const optionCards = options.map((o: any, i: number) => `
    <div style="margin-bottom:16px;border-radius:6px;overflow:hidden;">
      <div style="background:${optionColors[i] || '#0D1B2A'};padding:14px 20px;">
        <div style="color:#C9A84C;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:4px;">Option ${o.letter} — ${o.title}</div>
        <div style="color:white;font-size:13px;font-weight:bold;font-family:Arial,sans-serif;">${o.ship || ''}</div>
        ${o.price ? `<div style="color:#C9A84C;font-size:12px;font-family:Arial,sans-serif;margin-top:4px;">Est. ${o.price}</div>` : ''}
      </div>
      <div style="background:#f8f6f0;padding:14px 20px;">
        <p style="margin:0;font-size:13px;color:#4A5568;line-height:1.7;font-family:Arial,sans-serif;">${o.desc || ''}</p>
      </div>
    </div>`).join('');

  const itinRows = itinerary.map((r: any, i: number) => `
    <tr style="background:${i % 2 === 0 ? '#f8f6f0' : 'white'};">
      <td style="padding:8px 12px;font-size:12px;font-weight:bold;color:#0D1B2A;font-family:Arial,sans-serif;white-space:nowrap;">${r.day}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:bold;color:#C9A84C;font-family:Arial,sans-serif;">${r.port}</td>
      <td style="padding:8px 12px;font-size:12px;color:#4A5568;font-family:Arial,sans-serif;">${r.activity}</td>
    </tr>`).join('');

  const inclusionItems = inclusions.map((inc: string) =>
    `<li style="margin-bottom:6px;font-size:13px;color:#4A5568;font-family:Arial,sans-serif;">${inc}</li>`
  ).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede6;padding:24px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr><td style="background:#0D1B2A;padding:28px 36px;">
    <div style="font-family:Georgia,serif;font-size:32px;color:white;font-weight:normal;">Crestwell</div>
    <div style="font-family:Arial,sans-serif;font-size:12px;color:#C9A84C;letter-spacing:0.2em;text-transform:uppercase;margin-top:2px;">Travel Services</div>
    <div style="height:2px;background:linear-gradient(90deg,#C9A84C,transparent);margin-top:12px;"></div>
  </td></tr>

  <!-- GREETING -->
  <tr><td style="padding:32px 36px 0;">
    <p style="font-family:Georgia,serif;font-size:22px;color:#0D1B2A;margin:0 0 12px;">Hi ${clientName.split(' ')[0]},</p>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#4A5568;line-height:1.7;margin:0 0 24px;">
      Thank you for your interest in a <strong>${destination}</strong> ${tripType.toLowerCase()}!
      ${budget ? `Based on your budget of <strong>${budget}</strong>` : 'Based on your travel goals'},
      ${travelers ? `for <strong>${travelers}</strong>,` : ''} here are my recommended options for you.
      There is <strong>no booking fee</strong> — I'm here to make planning as easy as possible.
    </p>
  </td></tr>

  <!-- QUOTE DETAILS -->
  <tr><td style="padding:0 36px 24px;">
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#0D1B2A;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Your Quote Details</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;">
      <tr style="background:#f8f6f0;"><td style="padding:8px 14px;font-size:12px;font-weight:bold;color:#0D1B2A;font-family:Arial,sans-serif;width:35%;">Destination</td><td style="padding:8px 14px;font-size:12px;color:#4A5568;font-family:Arial,sans-serif;">${destination}</td></tr>
      <tr style="background:white;"><td style="padding:8px 14px;font-size:12px;font-weight:bold;color:#0D1B2A;font-family:Arial,sans-serif;">Trip Type</td><td style="padding:8px 14px;font-size:12px;color:#4A5568;font-family:Arial,sans-serif;">${tripType}</td></tr>
      ${budget ? `<tr style="background:#f8f6f0;"><td style="padding:8px 14px;font-size:12px;font-weight:bold;color:#0D1B2A;font-family:Arial,sans-serif;">Budget</td><td style="padding:8px 14px;font-size:12px;color:#4A5568;font-family:Arial,sans-serif;">${budget}</td></tr>` : ''}
      ${travelers ? `<tr style="background:white;"><td style="padding:8px 14px;font-size:12px;font-weight:bold;color:#0D1B2A;font-family:Arial,sans-serif;">Travelers</td><td style="padding:8px 14px;font-size:12px;color:#4A5568;font-family:Arial,sans-serif;">${travelers}</td></tr>` : ''}
    </table>
  </td></tr>

  <!-- OPTIONS -->
  ${optionCards ? `<tr><td style="padding:0 36px 24px;">
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#0D1B2A;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Recommended Options</div>
    ${optionCards}
  </td></tr>` : ''}

  <!-- ITINERARY -->
  ${itinRows ? `<tr><td style="padding:0 36px 24px;">
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#0D1B2A;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Sample Itinerary</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;">
      <tr style="background:#0D1B2A;"><td style="padding:8px 12px;font-size:11px;font-weight:bold;color:white;font-family:Arial,sans-serif;">Day</td><td style="padding:8px 12px;font-size:11px;font-weight:bold;color:white;font-family:Arial,sans-serif;">Port / Location</td><td style="padding:8px 12px;font-size:11px;font-weight:bold;color:white;font-family:Arial,sans-serif;">Highlights</td></tr>
      ${itinRows}
    </table>
  </td></tr>` : ''}

  <!-- INCLUSIONS -->
  ${inclusionItems ? `<tr><td style="padding:0 36px 24px;">
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#0D1B2A;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">What's Included</div>
    <ul style="margin:0;padding-left:20px;">${inclusionItems}</ul>
  </td></tr>` : ''}

  <!-- ADD-ONS NOTE -->
  <tr><td style="padding:0 36px 24px;">
    <div style="border-left:4px solid #C9A84C;background:#fdf9ee;padding:16px 20px;border-radius:0 6px 6px 0;">
      <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#0D1B2A;margin-bottom:6px;">Also Available</div>
      <p style="margin:0;font-size:13px;color:#4A5568;line-height:1.7;font-family:Arial,sans-serif;">
        If needed, I can also quote <strong>flights</strong> to your departure port, <strong>pre- or post-cruise hotel stays</strong>, and <strong>airport and port transfers</strong>. Just let me know and I'll include everything in your package at no extra charge.
      </p>
    </div>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 36px 32px;">
    <div style="background:#f8f6f0;border-radius:6px;padding:24px;text-align:center;">
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#4A5568;line-height:1.7;margin:0 0 20px;">
        Ready to move forward? Reply to this email or call me directly — I'll lock in your pricing and availability right away.
      </p>
      <a href="mailto:info@crestwellgetaways.com?subject=Quote%20Reply%20–%20${encodeURIComponent(destination)}&body=Hi%20Tim%2C%0A%0AI'm%20interested%20in%20moving%20forward%20with%20my%20${encodeURIComponent(destination)}%20quote."
         style="display:inline-block;background:#C9A84C;color:#0D1B2A;padding:14px 36px;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;border-radius:4px;">
        Reply to Tim
      </a>
      <div style="margin-top:14px;">
        <a href="tel:8885086893" style="font-family:Arial,sans-serif;font-size:13px;color:#0D1B2A;text-decoration:none;">📞 888.508.6893</a>
      </div>
    </div>
  </td></tr>

  <!-- SIGNATURE -->
  <tr><td style="border-top:3px solid #C9A84C;padding:20px 36px;background:#0D1B2A;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-family:Georgia,serif;font-size:16px;color:white;">Tim Crestwell</div>
          <div style="font-family:Arial,sans-serif;font-size:12px;color:#C9A84C;margin-top:2px;">Crestwell Travel Services</div>
          <div style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px;">ASTA Member · CLIA Certified · Carnival Diamond · NCL Master's</div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.7);">888.508.6893</div>
          <div style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.7);">info@crestwellgetaways.com</div>
          <div style="font-family:Arial,sans-serif;font-size:12px;color:#C9A84C;">crestwellgetaways.com</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- LEGAL -->
  <tr><td style="padding:12px 36px;background:#f8f6f0;text-align:center;">
    <p style="font-family:Arial,sans-serif;font-size:10px;color:#9ca3af;margin:0;">
      Prices subject to availability and change without notice. Seller of Travel laws may apply for bookings to CA, FL, HI &amp; WA. &nbsp;·&nbsp; Fla. Seller of Travel Ref. No. ST46414
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}
