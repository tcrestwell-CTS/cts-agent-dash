// ASHLEY — Agent 4: Quote Generator
// Sends a branded HTML quote email to the client — no attachments.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPA_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_SVC     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const AGENT_SECRET = Deno.env.get('CW_AGENT_SECRET') ?? '';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const secret = req.headers.get('x-agent-secret') || '';
  if (secret !== AGENT_SECRET)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

  const body = await req.json().catch(() => ({}));
  const { lead_id } = body;
  if (!lead_id)
    return new Response(JSON.stringify({ error: 'lead_id required' }), { status: 400, headers: CORS });

  const db = createClient(SUPA_URL, SUPA_SVC);
  const { data: lead, error } = await db.from('quote_requests').select('*').eq('id', lead_id).single();
  if (error || !lead)
    return new Response(JSON.stringify({ error: 'Lead not found' }), { status: 404, headers: CORS });

  const proposal: string = lead.proposal_draft ?? '';
  if (!proposal)
    return new Response(JSON.stringify({ error: 'No proposal draft. Run Terrance first.' }), { status: 400, headers: CORS });

  const sections   = parseProposal(proposal);
  const firstName  = lead.first_name || 'there';
  const clientName = `${lead.first_name} ${lead.last_name}`.trim();
  const destination = lead.destination || 'your destination';
  const tripType   = lead.trip_type || 'Vacation';
  const budget     = lead.budget || '';
  const travelers  = lead.travelers_adults ? `${lead.travelers_adults} adult(s)` : '';

  // Build fully formatted HTML email — no attachments
  const html = buildQuoteEmail({ firstName, clientName, destination, tripType, budget, travelers, sections });

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Tim Crestwell <info@crestwellgetaways.com>',
      to: [lead.email],
      reply_to: 'info@crestwellgetaways.com',
      subject: `Your ${destination} Travel Quote — Crestwell Travel Services`,
      html,
    }),
  });

  const emailData = await emailRes.json().catch(() => ({}));
  const emailOk = emailRes.ok;

  await db.from('quote_requests').update({
    proposal_status: emailOk ? 'quote_sent' : 'quote_failed',
    ai_processed_at: new Date().toISOString(),
  }).eq('id', lead_id);

  if (emailOk) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Crestwell AI <noreply@crestwellgetaways.com>',
        to: ['tcrestwell@crestwellgetaways.com'],
        subject: `✅ Ashley sent quote to ${clientName}`,
        html: `<p style="font-family:Arial,sans-serif;">Ashley sent the branded quote email to <strong>${clientName}</strong> at <strong>${lead.email}</strong>.</p><p style="font-family:Arial,sans-serif;"><strong>Destination:</strong> ${destination}<br><strong>Budget:</strong> ${budget}</p>`,
      }),
    });
  }

  return new Response(JSON.stringify({
    success: emailOk, lead_id, client: clientName,
    email: lead.email, email_id: emailData?.id, agent: 'Ashley',
  }), { status: 200, headers: CORS });
});

// ── PARSER ──────────────────────────────────────────────────────────────────
function parseProposal(text: string) {
  const lines = text.split('\n');
  const options: { letter: string; title: string; ship: string; price: string; desc: string }[] = [];
  const itinerary: { day: string; port: string; activity: string }[] = [];
  const inclusions: string[] = [];
  let currentSection = '';

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;

    if (l.startsWith('### Option')) {
      currentSection = 'option';
      const match = l.match(/### Option ([A-C]) [\u2014\-] (.+)/);
      if (match) options.push({ letter: match[1], title: match[2], ship: '', price: '', desc: '' });
    } else if (currentSection === 'option' && options.length > 0) {
      const last = options[options.length - 1];
      if (l.startsWith('**') && !last.ship) {
        const clean = l.replace(/\*\*/g, '');
        const parts = clean.split('|');
        last.ship = parts.slice(0, -1).map((p: string) => p.trim()).join(' | ') || clean;
        const pm = l.match(/Est\.?\s*\$[\d,\u2013\-]+\s*(?:per person|pp)?/i);
        if (pm) last.price = pm[0];
      } else if (!l.startsWith('#') && !l.startsWith('|') && !l.startsWith('-') && !l.startsWith('*')) {
        last.desc += (last.desc ? ' ' : '') + l;
      }
    }

    if (/^\|\s*Day/.test(l)) { currentSection = 'itin'; continue; }
    if (currentSection === 'itin' && l.startsWith('|') && !l.startsWith('|---')) {
      const parts = l.split('|').filter((p: string) => p.trim()).map((p: string) => p.trim());
      if (parts.length >= 2) itinerary.push({ day: parts[0], port: parts[1], activity: parts[2] || '' });
    }

    if (/## Key Inclusions|## What.s Included/i.test(l)) currentSection = 'inclusions';
    if (currentSection === 'inclusions' && l.startsWith('- '))
      inclusions.push(l.replace(/^- \*\*/, '').replace(/\*\*/g, '').replace(/^- /, ''));

    if (l.startsWith('## Tim') || l.startsWith('---')) currentSection = 'end';
  }
  return { options, itinerary, inclusions };
}

// ── EMAIL BUILDER ────────────────────────────────────────────────────────────
function buildQuoteEmail({ firstName, destination, tripType, budget, travelers, sections }: any) {
  const { options, itinerary, inclusions } = sections;
  const optionColors = ['#0D1B2A', '#2D6A4F', '#534AB7'];

  const optionCards = options.map((o: any, i: number) => `
    <div style="margin-bottom:16px;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:${optionColors[i] || '#0D1B2A'};padding:16px 20px;">
        <div style="color:#C9A84C;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:6px;">Option ${o.letter} &mdash; ${o.title}</div>
        <div style="color:white;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;line-height:1.4;">${o.ship || ''}</div>
        ${o.price ? `<div style="color:#C9A84C;font-size:13px;font-family:Arial,sans-serif;margin-top:6px;font-weight:600;">${o.price} per person</div>` : ''}
      </div>
      <div style="background:#f8f6f0;padding:16px 20px;">
        <p style="margin:0;font-size:13px;color:#4A5568;line-height:1.75;font-family:Arial,sans-serif;">${o.desc || ''}</p>
      </div>
    </div>`).join('');

  const itinRows = itinerary.map((r: any, i: number) => `
    <tr style="background:${i % 2 === 0 ? '#f8f6f0' : 'white'};">
      <td style="padding:9px 12px;font-size:12px;font-weight:bold;color:#0D1B2A;font-family:Arial,sans-serif;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${r.day}</td>
      <td style="padding:9px 12px;font-size:12px;font-weight:600;color:#C9A84C;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${r.port}</td>
      <td style="padding:9px 12px;font-size:12px;color:#4A5568;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${r.activity}</td>
    </tr>`).join('');

  const inclusionRows = inclusions.map((inc: string) =>
    `<tr><td style="padding:6px 0;font-family:Arial,sans-serif;"><span style="color:#C9A84C;font-weight:bold;margin-right:8px;">&#10003;</span><span style="font-size:13px;color:#4A5568;">${inc}</span></td></tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Travel Quote from Crestwell</title></head>
<body style="margin:0;padding:0;background:#f0ede6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede6;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:white;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

  <!-- HEADER -->
  <tr><td style="background:#0D1B2A;padding:32px 40px 24px;">
    <div style="font-family:Georgia,serif;font-size:34px;color:white;font-weight:normal;">Crestwell</div>
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#C9A84C;letter-spacing:0.25em;text-transform:uppercase;margin-top:4px;">Travel Services</div>
    <div style="height:2px;background:linear-gradient(90deg,#C9A84C,transparent);margin-top:16px;"></div>
  </td></tr>

  <!-- GREETING -->
  <tr><td style="padding:36px 40px 0;">
    <p style="font-family:Georgia,serif;font-size:24px;color:#0D1B2A;margin:0 0 16px;">Hi ${firstName},</p>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#4A5568;line-height:1.75;margin:0 0 8px;">
      Thank you for your interest in a <strong style="color:#0D1B2A;">${destination}</strong> ${tripType.toLowerCase()}!
      ${budget ? `Based on your budget of <strong style="color:#0D1B2A;">${budget}</strong>` : 'Based on your travel goals'}${travelers ? ` for <strong style="color:#0D1B2A;">${travelers}</strong>` : ''},
      I've put together my recommended options below.
    </p>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#4A5568;line-height:1.75;margin:0;">There is <strong>no booking fee</strong> &mdash; I'm here to make planning easy.</p>
  </td></tr>

  <tr><td style="padding:24px 40px 0;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

  <!-- QUOTE DETAILS -->
  <tr><td style="padding:24px 40px 0;">
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#0D1B2A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:12px;">Your Quote Details</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr style="background:#f8f6f0;"><td style="padding:10px 14px;font-size:12px;font-weight:700;color:#0D1B2A;width:38%;">Destination</td><td style="padding:10px 14px;font-size:13px;color:#4A5568;">${destination}</td></tr>
      <tr style="background:white;"><td style="padding:10px 14px;font-size:12px;font-weight:700;color:#0D1B2A;">Trip Type</td><td style="padding:10px 14px;font-size:13px;color:#4A5568;">${tripType}</td></tr>
      ${budget ? `<tr style="background:#f8f6f0;"><td style="padding:10px 14px;font-size:12px;font-weight:700;color:#0D1B2A;">Budget</td><td style="padding:10px 14px;font-size:13px;color:#4A5568;">${budget}</td></tr>` : ''}
      ${travelers ? `<tr style="background:white;"><td style="padding:10px 14px;font-size:12px;font-weight:700;color:#0D1B2A;">Travelers</td><td style="padding:10px 14px;font-size:13px;color:#4A5568;">${travelers}</td></tr>` : ''}
    </table>
  </td></tr>

  ${optionCards ? `
  <!-- OPTIONS -->
  <tr><td style="padding:28px 40px 0;">
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#0D1B2A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:12px;">Recommended Options</div>
    ${optionCards}
  </td></tr>` : ''}

  ${itinRows ? `
  <!-- ITINERARY -->
  <tr><td style="padding:28px 40px 0;">
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#0D1B2A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:12px;">Sample Itinerary</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr style="background:#0D1B2A;">
        <td style="padding:10px 12px;font-size:11px;font-weight:700;color:white;width:14%;">Day</td>
        <td style="padding:10px 12px;font-size:11px;font-weight:700;color:white;width:36%;">Port / Location</td>
        <td style="padding:10px 12px;font-size:11px;font-weight:700;color:white;">Highlights</td>
      </tr>
      ${itinRows}
    </table>
  </td></tr>` : ''}

  ${inclusionRows ? `
  <!-- INCLUSIONS -->
  <tr><td style="padding:28px 40px 0;">
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#0D1B2A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:12px;">What's Included</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inclusionRows}</table>
  </td></tr>` : ''}

  <!-- ADD-ONS NOTE -->
  <tr><td style="padding:28px 40px 0;">
    <div style="border-left:4px solid #C9A84C;background:#fdf9ee;padding:18px 22px;border-radius:0 8px 8px 0;">
      <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#0D1B2A;margin-bottom:8px;">Also Available</div>
      <p style="margin:0;font-size:13px;color:#4A5568;line-height:1.75;font-family:Arial,sans-serif;">If needed, I can also quote <strong>flights</strong>, <strong>pre- or post-cruise hotel stays</strong>, and <strong>airport &amp; port transfers</strong>. Just reply and I'll include everything at no extra charge.</p>
    </div>
  </td></tr>

  <tr><td style="padding:24px 40px 0;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

  <!-- CTA -->
  <tr><td style="padding:28px 40px 36px;">
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#4A5568;line-height:1.75;margin:0 0 20px;">Ready to move forward or have questions? Reply to this email or give me a call &mdash; I'll lock in your pricing right away.</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:12px;"><a href="mailto:info@crestwellgetaways.com?subject=Quote%20Reply%20%E2%80%93%20${encodeURIComponent(destination)}" style="display:inline-block;background:#C9A84C;color:#0D1B2A;padding:14px 32px;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border-radius:5px;">Reply to Tim</a></td>
        <td><a href="tel:8885086893" style="display:inline-block;background:#0D1B2A;color:white;padding:14px 32px;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border-radius:5px;">Call 888.508.6893</a></td>
      </tr>
    </table>
  </td></tr>

  <!-- SIGNATURE -->
  <tr><td style="border-top:3px solid #C9A84C;padding:24px 40px;background:#0D1B2A;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;width:60%;">
        <div style="font-family:Georgia,serif;font-size:18px;color:white;margin-bottom:4px;">Tim Crestwell</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#C9A84C;margin-bottom:6px;font-weight:600;">Crestwell Travel Services</div>
        <div style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.6;">ASTA Member &middot; CLIA Certified<br>Carnival Diamond &middot; NCL Master's Degree</div>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <div style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.65);margin-bottom:3px;">888.508.6893</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.65);margin-bottom:3px;">info@crestwellgetaways.com</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#C9A84C;margin-bottom:3px;">crestwellgetaways.com</div>
        <div style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.35);">Chattanooga, TN &middot; GA &middot; TN &middot; AL</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- LEGAL -->
  <tr><td style="padding:14px 40px 18px;background:#f8f6f0;text-align:center;">
    <p style="font-family:Arial,sans-serif;font-size:10px;color:#9ca3af;margin:0;line-height:1.6;">Prices subject to availability and change without notice. Seller of Travel laws may apply for bookings to CA, FL, HI &amp; WA. &nbsp;&middot;&nbsp; Fla. Seller of Travel Ref. No. ST46414</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}
