// =============================================================================
// CHRIS — Agent 4: Pre-Trip Nurture & Traveler Readiness
// =============================================================================
// Modes:
//   POST { trip_id }       — schedule milestone emails when trip moves to "booked"
//   POST { run_due: true } — process due nurture steps (called by pg_cron daily)
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireInternalOrUser } from '../_shared/internal-auth.ts';

const SUPA_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_SVC   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// ── Milestone steps ─────────────────────────────────────────────────────────
// step key → days before departure (negative = after booking, positive = before departure)
const MILESTONES = [
  { step: 'booked',      offset_type: 'after_booking',   days: 0 },   // Immediate
  { step: '4_months_out', offset_type: 'before_departure', days: 120 },
  { step: '2_months_out', offset_type: 'before_departure', days: 60 },
  { step: '1_month_out',  offset_type: 'before_departure', days: 30 },
  { step: '2_weeks_out',  offset_type: 'before_departure', days: 14 },
  { step: '1_week_out',   offset_type: 'before_departure', days: 7 },
];

// ── Claude email generator ──────────────────────────────────────────────────
async function claudeNurtureEmail(
  step: string,
  trip: any,
  client: any,
  branding: any
): Promise<{ subject: string; html: string }> {
  const clientName = client.preferred_first_name || client.first_name || client.name;
  const destination = trip.destination || 'your destination';
  const tripName = trip.trip_name || 'your trip';
  const departDate = trip.departure_date || trip.depart_date || 'TBD';

  const stepContextMap: Record<string, string> = {
    booked: `This is the BOOKING CONFIRMATION email — the traveler just got booked!
Your goal: celebrate the booking, build excitement, set expectations for next steps.
Mention: destination, trip name, and that you'll be in touch with updates as the trip approaches.
Include a brief "what to expect next" — passport check, travel insurance consideration, etc.`,

    '4_months_out': `This is a 4-MONTH countdown email.
Your goal: start building anticipation. Suggest they check passport expiration (6 months from travel).
Mention travel insurance if not yet purchased. Keep it warm and exciting.
Remind them of the destination and departure date.`,

    '2_months_out': `This is a 2-MONTH countdown email.
Your goal: practical prep. Suggest they start thinking about:
- Packing lists appropriate for the destination
- Any required vaccinations or health precautions
- Currency/payment planning
- Notifying their bank of travel dates
Keep the excitement high while being practical.`,

    '1_month_out': `This is a 1-MONTH countdown email — excitement is building!
Your goal: final prep checklist. Cover:
- Confirm all documents are in order
- Download any needed apps (airline, hotel, etc.)
- Check-in reminders
- Travel day logistics
Make them feel like everything is handled.`,

    '2_weeks_out': `This is a 2-WEEK countdown email.
Your goal: final details and excitement peak. Cover:
- Online check-in reminders
- Packing final touches
- Weather check for destination
- Emergency contact info for the agency
Keep it short and actionable.`,

    '1_week_out': `This is the 1-WEEK countdown — almost time!
Your goal: final send-off energy. Cover:
- Day-of travel tips
- Airport/port arrival times
- Emergency contact: agency phone number
- "We're here if you need anything during your trip"
Short, warm, exciting. Make them feel taken care of.`,
  };

  const stepContext = stepContextMap[step] || '';

  const prompt = `You are Tim Crestwell, owner of Crestwell Travel Services — a Southeast US travel agency specializing in cruises, all-inclusive resorts, and group travel.

Write a pre-trip nurture email. Return ONLY valid JSON: {"subject": "...", "body": "..."}

Rules:
- body uses only HTML <p>, <ul>, <li>, <strong> tags
- subject is specific and exciting (include destination or trip name)
- Sign off as Tim Crestwell, 888.508.6893
- Do NOT mention "AI", "automated", "drip", or "sequence"
- Do NOT use placeholders — use actual trip data
- Keep it personal and warm

STEP CONTEXT:
${stepContext}

TRIP DETAILS:
Client: ${clientName}
Trip: ${tripName}
Destination: ${destination}
Departure: ${departDate}
Trip type: ${trip.trip_type || 'vacation'}`;

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
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const raw = ((await res.json()).content?.[0]?.text ?? '{}')
      .replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    return {
      subject: parsed.subject ?? `${tripName} — ${step.replace(/_/g, ' ')}`,
      html: wrapEmail(parsed.body ?? `<p>Hi ${clientName}, just checking in about your upcoming trip!</p>`, branding),
    };
  } catch (e) {
    console.error('Claude nurture email error:', e);
    return {
      subject: `${tripName} — ${step.replace(/_/g, ' ')} update`,
      html: wrapEmail(
        `<p>Hi ${clientName},</p><p>Just a quick update about your upcoming trip to ${destination}. We're here if you need anything!</p><p>Tim Crestwell<br/>Crestwell Travel Services<br/>888.508.6893</p>`,
        branding
      ),
    };
  }
}

function wrapEmail(body: string, branding: any): string {
  const logoUrl = branding?.logo_url || 'https://zbtnulzvwreqzbmxulpv.supabase.co/storage/v1/object/public/email-assets/cts-logo.png';
  const agencyName = branding?.agency_name || 'Crestwell Travel Services';
  const primaryColor = branding?.primary_color || '#0D7377';
  const phone = branding?.phone || '888.508.6893';
  const website = branding?.website || 'https://crestwellgetaways.com';

  let portalBaseUrl = 'https://app.crestwelltravels.com';
  const portalUrl = `${portalBaseUrl}/client`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;padding:32px 28px;">
    <img src="${logoUrl}" alt="${agencyName}" style="height:40px;margin-bottom:24px;">
    ${body}
  </div>
  <div style="max-width:600px;margin:0 auto;padding:16px 28px;text-align:center;">
    <p style="font-size:12px;color:#666;margin:0 0 8px;">
      <a href="${portalUrl}" style="color:${primaryColor};text-decoration:underline;">Access Your Client Portal</a>
    </p>
    <p style="font-size:11px;color:#999;margin:0;">
      ${agencyName} · ${phone} ·
      <a href="${website}" style="color:#999;">${website.replace('https://', '')}</a>
    </p>
  </div>
</body>
</html>`;
}

// ── Schedule nurture sequence ───────────────────────────────────────────────
async function scheduleNurture(db: any, trip: any): Promise<{ scheduled: number }> {
  if (trip.nurture_started) {
    console.log(`Nurture already started for trip ${trip.id}`);
    return { scheduled: 0 };
  }

  if (!trip.client_id) {
    console.log(`No client on trip ${trip.id}, skipping nurture`);
    return { scheduled: 0 };
  }

  const now = new Date();
  const departDate = trip.departure_date || trip.depart_date;
  const departure = departDate ? new Date(departDate) : null;

  const rows: any[] = [];
  for (const m of MILESTONES) {
    let scheduledAt: Date;

    if (m.offset_type === 'after_booking') {
      scheduledAt = new Date(now.getTime() + m.days * 24 * 60 * 60 * 1000);
    } else {
      // before_departure
      if (!departure) {
        // No departure date — skip countdown milestones, only send booking confirmation
        if (m.step !== 'booked') continue;
        scheduledAt = now;
      } else {
        scheduledAt = new Date(departure.getTime() - m.days * 24 * 60 * 60 * 1000);
        // Don't schedule if the milestone is already in the past
        if (scheduledAt <= now && m.step !== 'booked') continue;
      }
    }

    rows.push({
      trip_id:      trip.id,
      user_id:      trip.user_id,
      step:         m.step,
      scheduled_at: scheduledAt.toISOString(),
      status:       'pending',
    });
  }

  if (rows.length === 0) {
    console.log(`No milestones to schedule for trip ${trip.id}`);
    return { scheduled: 0 };
  }

  const { error } = await db.from('trip_nurture_steps').insert(rows);
  if (error) {
    console.error('Nurture schedule insert error:', error.message);
    return { scheduled: 0 };
  }

  await db.from('trips').update({ nurture_started: true }).eq('id', trip.id);
  console.log(`Scheduled ${rows.length} nurture steps for trip ${trip.id}`);
  return { scheduled: rows.length };
}

// ── Send one nurture email ──────────────────────────────────────────────────
async function sendNurtureEmail(db: any, nurtureStep: any, trip: any, client: any): Promise<boolean> {
  if (trip.nurture_paused || trip.status === 'cancelled') {
    await db.from('trip_nurture_steps').update({ status: 'skipped' }).eq('id', nurtureStep.id);
    console.log(`Skipped ${nurtureStep.step} for trip ${trip.id} — paused or cancelled`);
    return false;
  }

  if (!client?.email) {
    await db.from('trip_nurture_steps').update({ status: 'skipped' }).eq('id', nurtureStep.id);
    console.log(`Skipped ${nurtureStep.step} — no client email`);
    return false;
  }

  // Get branding
  const { data: branding } = await db
    .from('branding_settings')
    .select('*')
    .eq('user_id', trip.user_id)
    .maybeSingle();

  const { subject, html } = await claudeNurtureEmail(nurtureStep.step, trip, client, branding);

  const fromEmail = branding?.from_email || 'tim@crestwellgetaways.com';
  const fromName = branding?.from_name || 'Tim at Crestwell';

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:     `${fromName} <${fromEmail}>`,
      to:       client.email,
      reply_to: 'info@crestwellgetaways.com',
      subject,
      html,
    }),
  });
  const emailData = await emailRes.json();

  if (!emailRes.ok) {
    console.error(`Resend error ${nurtureStep.step}:`, JSON.stringify(emailData));
    return false;
  }

  await db.from('trip_nurture_steps').update({
    status:    'sent',
    sent_at:   new Date().toISOString(),
    resend_id: emailData.id,
  }).eq('id', nurtureStep.id);

  // Log the email
  await db.from('email_logs').insert({
    user_id:   trip.user_id,
    client_id: trip.client_id,
    to_email:  client.email,
    subject,
    template:  `nurture_${nurtureStep.step}`,
    status:    'sent',
  });

  console.log(`✓ Nurture ${nurtureStep.step} → ${client.email} | ${emailData.id}`);
  return true;
}

// ── Process all due nurture steps ───────────────────────────────────────────
async function processDue(db: any): Promise<{ processed: number; sent: number; skipped: number }> {
  const { data: due, error } = await db
    .from('trip_nurture_steps')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('processDue error:', error.message);
    return { processed: 0, sent: 0, skipped: 0 };
  }
  if (!due?.length) {
    console.log('No due nurture steps');
    return { processed: 0, sent: 0, skipped: 0 };
  }

  console.log(`Processing ${due.length} due nurture steps`);
  let sent = 0, skipped = 0;

  for (const step of due) {
    // Fetch trip
    const { data: trip } = await db
      .from('trips')
      .select('*')
      .eq('id', step.trip_id)
      .single();

    if (!trip) { skipped++; continue; }

    // Fetch client
    const { data: client } = await db
      .from('clients')
      .select('name, email, first_name, preferred_first_name')
      .eq('id', trip.client_id)
      .maybeSingle();

    if (!client) { skipped++; continue; }

    const ok = await sendNurtureEmail(db, step, trip, client);
    if (ok) sent++; else skipped++;

    // Rate limit spacing
    await new Promise(r => setTimeout(r, 300));
  }

  return { processed: due.length, sent, skipped };
}

// ── Handler ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
  }

  // Auth: accept service role bearer token
  const auth = await requireInternalOrUser(req, CORS);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => ({}));
  const db = createClient(SUPA_URL, SUPA_SVC);

  // Mode 1: Schedule nurture for a specific trip
  if (body.trip_id) {
    const { data: trip } = await db.from('trips').select('*').eq('id', body.trip_id).single();
    if (!trip) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), { status: 404, headers: CORS });
    }
    const result = await scheduleNurture(db, trip);
    return new Response(JSON.stringify(result), { headers: CORS });
  }

  // Mode 2: Process all due nurture steps (cron)
  if (body.run_due) {
    const result = await processDue(db);
    return new Response(JSON.stringify(result), { headers: CORS });
  }

  return new Response(
    JSON.stringify({ error: 'trip_id or run_due required' }),
    { status: 400, headers: CORS }
  );
});
