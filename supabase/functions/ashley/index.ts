// ASHLEY — Agent 4: Quote Generator
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

  const html = buildQuoteEmail({ firstName, destination, tripType, budget, travelers, sections });

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
        html: `<p style="font-family:Arial,sans-serif;">Ashley sent the branded quote to <strong>${clientName}</strong> at <strong>${lead.email}</strong>.</p><p style="font-family:Arial,sans-serif;"><strong>Destination:</strong> ${destination}<br><strong>Budget:</strong> ${budget}</p>`,
      }),
    });
  }

  return new Response(JSON.stringify({
    success: emailOk, lead_id, client: clientName,
    email: lead.email, email_id: emailData?.id, agent: 'Ashley',
  }), { status: 200, headers: CORS });
});

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
      const match = l.match(/### Option ([A-C]) [—\-] (.+)/);
      if (match) options.push({ letter: match[1], title: match[2], ship: '', price: '', desc: '' });
    } else if (currentSection === 'option' && options.length > 0) {
      const last = options[options.length - 1];
      if (l.startsWith('**') && !last.ship) {
        const clean = l.replace(/\*\*/g, '');
        const parts = clean.split('|');
        last.ship = parts.slice(0, -1).map((p: string) => p.trim()).join(' | ') || clean;
        const pm = l.match(/Est\.?\s*\$[\d,–\-]+\s*(?:per person|pp)?/i);
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

function buildQuoteEmail({ firstName, destination, tripType, budget, travelers, sections }: any) {
  const { options, itinerary, inclusions } = sections;
  const optionColors = ['#0D1B2A', '#2D6A4F', '#534AB7'];

  const optionCards = options.map((o: any, i: number) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">
  <tr><td style="background:${optionColors[i] || '#0D1B2A'};padding:18px 24px;">
    <div style="color:#C9A84C;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:6px;">Option ${o.letter} &mdash; ${o.title}</div>
    <div style="color:#ffffff;font-size:15px;font-weight:bold;font-family:Arial,sans-serif;line-height:1.4;">${o.ship || ''}</div>
    ${o.price ? `<div style="color:#C9A84C;font-size:13px;font-family:Arial,sans-serif;margin-top:7px;font-weight:600;">${o.price} per person</div>` : ''}
  </td></tr>
  <tr><td style="background:#f8f6f0;padding:16px 24px;">
    <p style="margin:0;font-size:14px;color:#4A5568;line-height:1.8;font-family:Arial,sans-serif;">${o.desc || ''}</p>
  </td></tr>
</table>`).join('');

  const itinRows = itinerary.map((r: any, i: number) => `
<tr style="background:${i % 2 === 0 ? '#f8f6f0' : '#ffffff'};">
  <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#0D1B2A;font-family:Arial,sans-serif;white-space:nowrap;border-bottom:1px solid #e2e8f0;width:90px;">${r.day}</td>
  <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#C9A84C;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;width:220px;">${r.port}</td>
  <td style="padding:10px 14px;font-size:13px;color:#4A5568;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${r.activity}</td>
</tr>`).join('');

  const inclusionRows = inclusions.map((inc: string) =>
    `<tr><td style="padding:7px 0;font-family:Arial,sans-serif;"><span style="color:#C9A84C;font-weight:bold;margin-right:10px;font-size:15px;">&#10003;</span><span style="font-size:14px;color:#4A5568;">${inc}</span></td></tr>`
  ).join('');

  const detailRows = [
    ['Destination', destination],
    ['Trip Type', tripType],
    ...(budget ? [['Budget', budget]] : []),
    ...(travelers ? [['Travelers', travelers]] : []),
  ].map(([label, value], i) =>
    `<tr style="background:${i % 2 === 0 ? '#f8f6f0' : '#ffffff'};">
      <td style="padding:11px 16px;font-size:13px;font-weight:700;color:#0D1B2A;font-family:Arial,sans-serif;width:160px;border-bottom:1px solid #e2e8f0;">${label}</td>
      <td style="padding:11px 16px;font-size:13px;color:#4A5568;font-family:Arial,sans-serif;border-bottom:1px solid #e2e8f0;">${value}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Your Travel Quote from Crestwell</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style type="text/css">
  body, #bodyTable { margin:0; padding:0; background-color:#f0ede6; width:100%; }
  table { border-spacing:0; mso-table-lspace:0pt; mso-table-rspace:0pt; }
  td { border-collapse:collapse; }
  .email-outer { background:#f0ede6; width:100%; padding:32px 0; }
  .email-wrap { width:680px; margin:0 auto; }
  .email-body { background:#ffffff; border-radius:10px; overflow:hidden; }
  .pad { padding-left:48px; padding-right:48px; }
  .btn-gold { background:#C9A84C; color:#0D1B2A !important; padding:14px 36px; text-decoration:none; font-family:Arial,sans-serif; font-size:13px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; border-radius:5px; display:inline-block; }
  .btn-navy { background:#0D1B2A; color:#ffffff !important; padding:14px 36px; text-decoration:none; font-family:Arial,sans-serif; font-size:13px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; border-radius:5px; display:inline-block; }
  @media only screen and (max-width:700px) {
    .email-wrap { width:100% !important; }
    .email-body { border-radius:0 !important; }
    .pad { padding-left:20px !important; padding-right:20px !important; }
    .sig-left, .sig-right { display:block !important; width:100% !important; text-align:left !important; }
    .btn-cell { display:block !important; padding-right:0 !important; padding-bottom:10px !important; width:100% !important; }
    .btn-gold, .btn-navy { display:block !important; text-align:center !important; width:100% !important; box-sizing:border-box; }
  }
</style>
</head>
<body>
<div class="email-outer">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" class="email-wrap" cellpadding="0" cellspacing="0">
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-body">

<!-- HEADER -->
<tr><td class="pad" style="background:#0D1B2A;padding-top:36px;padding-bottom:28px;">
  <div style="font-family:Georgia,serif;font-size:36px;color:#ffffff;font-weight:normal;">Crestwell</div>
  <div style="font-family:Arial,sans-serif;font-size:11px;color:#C9A84C;letter-spacing:0.28em;text-transform:uppercase;margin-top:5px;">Travel Services</div>
  <div style="height:2px;background:linear-gradient(90deg,#C9A84C,rgba(201,168,76,0));margin-top:18px;"></div>
</td></tr>

<!-- GREETING -->
<tr><td class="pad" style="padding-top:36px;padding-bottom:0;">
  <p style="font-family:Georgia,serif;font-size:26px;color:#0D1B2A;margin:0 0 16px;font-weight:normal;">Hi ${firstName},</p>
  <p style="font-family:Arial,sans-serif;font-size:15px;color:#4A5568;line-height:1.8;margin:0 0 10px;">Thank you for your interest in a <strong style="color:#0D1B2A;">${destination}</strong> ${tripType.toLowerCase()}! ${budget ? `Based on your budget of <strong style="color:#0D1B2A;">${budget}</strong>` : 'Based on your travel goals'}${travelers ? ` for <strong style="color:#0D1B2A;">${travelers}</strong>` : ''}, I have put together my recommended options below.</p>
  <p style="font-family:Arial,sans-serif;font-size:15px;color:#4A5568;line-height:1.8;margin:0;">There is <strong>no booking fee</strong> &mdash; I am here to make planning easy for you.</p>
</td></tr>

<!-- DIVIDER -->
<tr><td class="pad" style="padding-top:28px;padding-bottom:0;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

<!-- QUOTE DETAILS -->
<tr><td class="pad" style="padding-top:28px;padding-bottom:0;">
  <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#0D1B2A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:14px;">Your Quote Details</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">${detailRows}</table>
</td></tr>

${optionCards ? `<tr><td class="pad" style="padding-top:32px;padding-bottom:0;">
  <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#0D1B2A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:14px;">Recommended Options</div>
  ${optionCards}
</td></tr>` : ''}

${itinRows ? `<tr><td class="pad" style="padding-top:32px;padding-bottom:0;">
  <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#0D1B2A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:14px;">Sample Itinerary</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr style="background:#0D1B2A;">
      <td style="padding:10px 14px;font-size:11px;font-weight:700;color:#fff;font-family:Arial,sans-serif;width:90px;">Day</td>
      <td style="padding:10px 14px;font-size:11px;font-weight:700;color:#fff;font-family:Arial,sans-serif;width:220px;">Port / Location</td>
      <td style="padding:10px 14px;font-size:11px;font-weight:700;color:#fff;font-family:Arial,sans-serif;">Highlights</td>
    </tr>
    ${itinRows}
  </table>
</td></tr>` : ''}

${inclusionRows ? `<tr><td class="pad" style="padding-top:32px;padding-bottom:0;">
  <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#0D1B2A;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:14px;">What is Included</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inclusionRows}</table>
</td></tr>` : ''}

<!-- ADD-ONS -->
<tr><td class="pad" style="padding-top:32px;padding-bottom:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:4px solid #C9A84C;background:#fdf9ee;border-radius:0 8px 8px 0;">
    <tr><td style="padding:18px 24px;">
      <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#0D1B2A;margin-bottom:8px;">Also Available</div>
      <p style="margin:0;font-size:14px;color:#4A5568;line-height:1.8;font-family:Arial,sans-serif;">If needed, I can also quote <strong>flights</strong>, <strong>pre- or post-cruise hotel stays</strong>, and <strong>airport &amp; port transfers</strong>. Just reply and I will include everything at no extra charge.</p>
    </td></tr>
  </table>
</td></tr>

<!-- DIVIDER -->
<tr><td class="pad" style="padding-top:28px;padding-bottom:0;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

<!-- CTA -->
<tr><td class="pad" style="padding-top:28px;padding-bottom:44px;">
  <p style="font-family:Arial,sans-serif;font-size:15px;color:#4A5568;line-height:1.8;margin:0 0 24px;">Ready to move forward or have questions? Reply to this email or give me a call &mdash; I will lock in your pricing right away.</p>
  <table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td class="btn-cell" style="padding-right:14px;">
        <a href="mailto:info@crestwellgetaways.com?subject=Quote%20Reply%20%E2%80%93%20${encodeURIComponent(destination)}" class="btn-gold">Reply to Tim</a>
      </td>
      <td class="btn-cell">
        <a href="tel:8885086893" class="btn-navy">Call 888.508.6893</a>
      </td>
    </tr>
  </table>
</td></tr>

<!-- SIGNATURE -->
<tr><td style="border-top:3px solid #C9A84C;background:#0D1B2A;padding:28px 48px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td class="sig-left" style="vertical-align:top;">
        <div style="font-family:Georgia,serif;font-size:20px;color:#fff;margin-bottom:5px;">Tim Crestwell</div>
        <div style="font-family:Arial,sans-serif;font-size:13px;color:#C9A84C;margin-bottom:8px;font-weight:600;">Crestwell Travel Services</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.7;">ASTA Member &middot; CLIA Certified<br>Carnival Diamond &middot; NCL Master's Degree</div>
      </td>
      <td class="sig-right" style="text-align:right;vertical-align:top;">
        <div style="font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:4px;">888.508.6893</div>
        <div style="font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:4px;">info@crestwellgetaways.com</div>
        <div style="font-family:Arial,sans-serif;font-size:13px;color:#C9A84C;margin-bottom:4px;">crestwellgetaways.com</div>
        <div style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.35);">Chattanooga, TN &middot; GA &middot; TN &middot; AL</div>
      </td>
    </tr>
  </table>
</td></tr>

<!-- LEGAL -->
<tr><td style="background:#f8f6f0;padding:14px 48px;text-align:center;">
  <p style="font-family:Arial,sans-serif;font-size:10px;color:#9ca3af;margin:0;line-height:1.6;">Prices subject to availability and change without notice. Seller of Travel laws may apply for bookings to CA, FL, HI &amp; WA. &nbsp;&middot;&nbsp; Fla. Seller of Travel Ref. No. ST46414</p>
</td></tr>

</table>
</td></tr>
</table>
</td></tr></table>
</div>
</body>
</html>`;
}
