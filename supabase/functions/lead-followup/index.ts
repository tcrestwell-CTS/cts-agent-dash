// supabase/functions/lead-followup/index.ts
// Qualified, Quote Needed and Call Needed leads. Claude generates every email fresh.
// Modes:
//   POST { lead_id }      — schedule 5-step sequence (called by qualify-lead after scoring)
//   POST { run_due:true } — process due steps (called by pg_cron hourly)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveAgentBranding } from '../_shared/agent-branding.ts';

const SUPA_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_SVC      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY    = Deno.env.get('RESEND_API_KEY') ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const AGENT_SECRET  = Deno.env.get('CW_AGENT_SECRET') ?? '';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

// Steps: 0=instant, 1=day2, 2=day5, 3=day10, 4=day21
const STEPS = [
  { step: 0, delay_days: 0  },
  { step: 1, delay_days: 2  },
  { step: 2, delay_days: 5  },
  { step: 3, delay_days: 10 },
  { step: 4, delay_days: 21 },
];

const STOP_STATUSES = ['booked', 'declined', 'do_not_contact', 'closed'];

// ── Claude email generator ──────────────────────────────────────────────────
async function claudeEmail(step: number, lead: any, brand: any): Promise<{ subject: string; html: string }> {
  const stepContext = [
    `This is the FIRST email they will receive from you — they just submitted a quote request minutes ago.
Your goal: warm welcome, acknowledge their specific trip, create confidence, give a clear next step.
Do NOT be salesy. Be the expert friend who knows travel.`,

    `This is a 2-day follow-up. They haven't replied yet.
Your goal: gentle nudge, remind them you have options ready, keep it short (under 100 words).
Reference a specific detail from their trip — don't repeat the first email.`,

    `This is a 5-day follow-up. Still no reply.
Your goal: add value — share one specific insight, tip, or option relevant to their destination or trip type.
Make it feel like a message from someone who genuinely knows travel, not a drip campaign.`,

    `This is a 10-day follow-up. Still no reply.
Your goal: be brief and honest. Acknowledge they're busy. Give them an easy out OR an easy yes.
Under 80 words. No pressure, but make the next step dead simple.`,

    `This is the FINAL follow-up at 21 days.
Your goal: close gracefully. Thank them for their time. Leave the door open for the future.
Mention Crestwell's specialties briefly. Under 80 words. Warm and human.`,
  ][step] ?? '';

  const prompt = `You are ${brand.advisorName}, travel advisor at ${brand.agencyName} — specializing in cruises, all-inclusive resorts, land trips worldwide, and group travel.

Write a follow-up email to a qualified travel lead. Return ONLY valid JSON: {"subject": "...", "body": "..."}

Rules:
- body uses only HTML <p> tags
- subject is specific to their trip (not generic)
- Sign off as ${brand.advisorName}, ${brand.agencyName}, ${brand.phone}
- Do NOT mention "AI", "automated", or "drip"
- Do NOT use placeholders — use actual lead data

STEP CONTEXT:
${stepContext}

LEAD:
Name: ${lead.first_name} ${lead.last_name}
Trip: ${lead.trip_type || 'not specified'} to ${lead.destination || 'open'}
Departure: ${lead.departure_date || 'flexible'}
Travelers: ${lead.travelers_adults || 2} adults, ${lead.travelers_children || 0} children
Budget: ${lead.budget || 'not specified'}
Message: ${lead.message || 'none'}
AI summary: ${lead.ai_summary || ''}
Wants financing: ${lead.wants_financing ? 'yes' : 'no'}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const raw = ((await res.json()).content?.[0]?.text ?? '{}')
      .replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    return {
      subject: parsed.subject ?? `Following up — ${lead.destination || 'your trip'}`,
      html: wrapEmail(parsed.body ?? `<p>Hi ${lead.first_name}, just following up. Reply anytime — ${brand.advisorName}</p>`, brand),
    };
  } catch (e) {
    console.error('Claude email error:', e);
    return {
      subject: `Following up — ${lead.destination || 'your trip'}`,
      html: wrapEmail(`<p>Hi ${lead.first_name}, just checking in on your ${lead.destination || 'travel'} inquiry. Reply whenever you're ready.</p><p>${brand.advisorName}<br/>${brand.agencyName}<br/>${brand.phone}</p>`, brand),
    };
  }
}

function wrapEmail(body: string, brand?: { agencyName: string; logoUrl: string | null; phone: string; website: string | null }): string {
  const agencyName = brand?.agencyName ?? 'Crestwell Travel Services';
  const logo = brand?.logoUrl ?? 'https://zbtnulzvwreqzbmxulpv.supabase.co/storage/v1/object/public/email-assets/cts-logo.png';
  const phone = brand?.phone ?? '888.508.6893';
  const site = brand?.website ?? 'https://crestwellgetaways.com';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;padding:32px 28px;">
    <img src="${logo}" alt="${agencyName}" style="height:40px;margin-bottom:24px;">
    ${body}
  </div>
  <div style="max-width:600px;margin:0 auto;padding:16px 28px;text-align:center;">
    <p style="font-size:11px;color:#999;margin:0;">
      You received this because you submitted a travel inquiry with ${agencyName}.<br/>
      To stop receiving follow-ups, reply with "stop".
    </p>
    <p style="font-size:11px;color:#999;margin:8px 0 0;">
      ${agencyName} · ${phone} ·
      <a href="${site}" style="color:#999;">${site.replace(/^https?:\/\//, '')}</a>
    </p>
  </div>
</body>
</html>`;
}

// ── Schedule sequence ───────────────────────────────────────────────────────
async function scheduleSequence(db: any, lead: any): Promise<{ scheduled: number }> {
  if (!['Qualified', 'Quote Needed', 'Call Needed'].includes(lead.ai_stage)) {
    console.log(`Skip sequence — ${lead.email} is ${lead.ai_stage}, not Qualified`);
    return { scheduled: 0 };
  }
  // Quote Needed / Call Needed sequences apply to leads created from 2026-11-20 on,
  // so older leads don't receive surprise emails. Qualified leads keep their original behavior.
  if (lead.ai_stage !== 'Qualified' && new Date(lead.created_at) < new Date('2026-11-20T00:00:00-05:00')) {
    console.log(`Skip sequence — ${lead.email} predates the ${lead.ai_stage} cutoff`);
    return { scheduled: 0 };
  }
  if (lead.sequence_started) {
    console.log(`Sequence already started for ${lead.email}`);
    return { scheduled: 0 };
  }

  const now = new Date();
  const rows = STEPS.map(({ step, delay_days }) => ({
    lead_id:      lead.id,
    step,
    scheduled_at: new Date(now.getTime() + delay_days * 24 * 60 * 60 * 1000).toISOString(),
    status:       'pending',
  }));

  const { error } = await db.from('lead_followups').insert(rows);
  if (error) {
    console.error('Schedule insert error:', error.message);
    return { scheduled: 0 };
  }

  await db.from('quote_requests').update({ sequence_started: true }).eq('id', lead.id);
  console.log(`Scheduled ${rows.length} steps for ${lead.email}`);
  return { scheduled: rows.length };
}

// ── Send one followup ───────────────────────────────────────────────────────
async function sendFollowup(db: any, followup: any, lead: any): Promise<boolean> {
  if (STOP_STATUSES.includes(lead.status) || lead.sequence_paused) {
    await db.from('lead_followups').update({ status: 'skipped' }).eq('id', followup.id);
    console.log(`Skipped step ${followup.step} for ${lead.email} — ${lead.status}`);
    return false;
  }

  const brand = await resolveAgentBranding(db, lead.assigned_agent_id);
  const { subject, html } = await claudeEmail(followup.step, lead, brand);

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:     lead.assigned_agent_id ? brand.from : 'Tim at Crestwell <tim@crestwellgetaways.com>',
      to:       lead.email,
      reply_to: brand.replyTo,
      subject,
      html,
    }),
  });
  const emailData = await emailRes.json();

  if (!emailRes.ok) {
    console.error(`Resend error step ${followup.step}:`, JSON.stringify(emailData));
    return false;
  }

  await db.from('lead_followups').update({
    status:    'sent',
    sent_at:   new Date().toISOString(),
    resend_id: emailData.id,
  }).eq('id', followup.id);

  console.log(`✓ Step ${followup.step} → ${lead.email} | ${emailData.id}`);
  return true;
}

// ── Process all due followups ───────────────────────────────────────────────
async function processDue(db: any): Promise<{ processed: number; sent: number; skipped: number }> {
  const { data: due, error } = await db
    .from('lead_followups')
    .select('*, quote_requests(*)')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(50);

  if (error) { console.error('processDue:', error.message); return { processed: 0, sent: 0, skipped: 0 }; }
  if (!due?.length) { console.log('No due followups'); return { processed: 0, sent: 0, skipped: 0 }; }

  console.log(`Processing ${due.length} due followups`);
  let sent = 0, skipped = 0;
  for (const followup of due) {
    const lead = followup.quote_requests;
    if (!lead) { skipped++; continue; }
    const ok = await sendFollowup(db, followup, lead);
    if (ok) sent++; else skipped++;
    await new Promise(r => setTimeout(r, 300));
  }
  return { processed: due.length, sent, skipped };
}

// ── Handler ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  const secret = req.headers.get('x-agent-secret') ?? '';
  if (AGENT_SECRET && secret !== AGENT_SECRET)
    return new Response('Unauthorized', { status: 401, headers: CORS });

  const body = await req.json().catch(() => ({}));
  const db   = createClient(SUPA_URL, SUPA_SVC);

  if (body.lead_id) {
    const { data: lead } = await db.from('quote_requests').select('*').eq('id', body.lead_id).single();
    if (!lead) return new Response(JSON.stringify({ error: 'Lead not found' }), { status: 404, headers: CORS });
    const result = await scheduleSequence(db, lead);
    return new Response(JSON.stringify(result), { headers: CORS });
  }

  if (body.run_due) {
    const result = await processDue(db);
    return new Response(JSON.stringify(result), { headers: CORS });
  }

  return new Response(JSON.stringify({ error: 'lead_id or run_due required' }), { status: 400, headers: CORS });
});
