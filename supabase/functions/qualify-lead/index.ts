import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const { lead_id } = await req.json();
  if (!lead_id) return new Response('lead_id required', { status: 400, headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Fetch the lead
  const { data: lead, error } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('id', lead_id)
    .single();

  if (error || !lead) {
    return new Response(JSON.stringify({ error: 'Lead not found' }), { status: 404, headers: corsHeaders });
  }

  // 2. Call Claude to qualify
  const prompt = `
You are a lead qualification agent for Crestwell Travel Services, a travel agency based in the Southeast US (Georgia, Tennessee, Alabama) specializing in cruises, all-inclusive resorts, and group vacations.

A new travel inquiry has come in. Analyze it and return a JSON object with these exact fields:

{
  "score": <integer 1-100, lead quality score>,
  "stage": <"Qualified" | "Quote Needed" | "Call Needed">,
  "summary": <one sentence describing the lead for Tim's dashboard>,
  "tags": <array of strings from: ["financing", "group", "luxury", "family", "honeymoon", "flexible", "urgent", "vague-budget", "repeat-client", "church", "corporate", "short-trip", "international"]>,
  "next_action": <one specific sentence telling Tim exactly what to do next>,
  "wants_financing": <boolean>
}

SCORING GUIDE:
- 80-100: Has destination + budget $3k+ + dates + traveler count + clear trip type → ready to quote now
- 60-79: Has most details but missing 1-2 things → worth a quick email to fill gaps
- 40-59: Vague (no budget, no dates, just exploring) → nurture, low priority
- 1-39: Incomplete contact info, spam-like, or clearly not serious

STAGE GUIDE:
- "Qualified": Score 70+, has enough info to build a real quote
- "Quote Needed": Score 50-69, missing some details but can start quote with clarification
- "Call Needed": Group of 10+, OR luxury ($10k+), OR financing interest, OR complex multi-destination

LEAD DATA:
Name: ${lead.first_name} ${lead.last_name}
Email: ${lead.email}
Phone: ${lead.phone || 'not provided'}
Trip Type: ${lead.trip_type || 'not specified'}
Destination: ${lead.destination || 'not specified'}
Departure Date: ${lead.departure_date || 'flexible/not specified'}
Date Flexibility: ${lead.flexibility || 'not specified'}
Adults: ${lead.travelers_adults || 'not specified'}
Children: ${lead.travelers_children || 0}
Budget: ${lead.budget || 'not specified'}
Message: ${lead.message || 'none'}

Return ONLY valid JSON. No explanation, no markdown, no preamble.
  `.trim();

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error('Anthropic API error:', aiRes.status, errText);
    return new Response(JSON.stringify({ error: 'AI qualification failed' }), { status: 502, headers: corsHeaders });
  }

  const aiData = await aiRes.json();
  const rawText = aiData.content?.[0]?.text || '{}';

  let qualification: any = {};
  try {
    qualification = JSON.parse(rawText);
  } catch {
    const clean = rawText.replace(/```json|```/g, '').trim();
    try { qualification = JSON.parse(clean); } catch { qualification = {}; }
  }

  const {
    score = 50,
    stage = 'Quote Needed',
    summary = '',
    tags = [],
    next_action = '',
    wants_financing = false,
  } = qualification;

  // 3. Write qualification back to Supabase
  await supabase.from('quote_requests').update({
    ai_score:        score,
    ai_stage:        stage,
    ai_summary:      summary,
    ai_tags:         tags,
    ai_next_action:  next_action,
    ai_processed_at: new Date().toISOString(),
    wants_financing,
    status:          stage === 'Qualified' ? 'qualified' : 'new',
  }).eq('id', lead_id);

  // 4. Send notification email
  const stageColor: Record<string, string> = {
    'Qualified':    '#22c55e',
    'Quote Needed': '#f59e0b',
    'Call Needed':  '#f97316',
  };
  const scoreBar = Math.round((score / 100) * 20);
  const scoreDisplay = '█'.repeat(scoreBar) + '░'.repeat(20 - scoreBar);
  const color = stageColor[stage] || '#94a3b8';

  const detailRows = [
    ['Name',        `${lead.first_name} ${lead.last_name}`],
    ['Email',       lead.email],
    ['Phone',       lead.phone || '—'],
    ['Trip Type',   lead.trip_type || '—'],
    ['Destination', lead.destination || '—'],
    ['Dates',       lead.departure_date || 'Flexible'],
    ['Travelers',   `${lead.travelers_adults || 2} adult(s), ${lead.travelers_children || 0} child(ren)`],
    ['Budget',      lead.budget || '—'],
    ['Financing',   wants_financing ? '✓ Interested' : 'No'],
    ['Tags',        tags.join(', ') || '—'],
  ].map(([label, value]) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#475569;width:120px;">${label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;">${value}</td>
    </tr>
  `).join('');

  const messageRow = lead.message ? `
    <tr>
      <td style="padding:8px 12px;font-weight:600;color:#475569;vertical-align:top;">Message</td>
      <td style="padding:8px 12px;color:#1e293b;">${lead.message}</td>
    </tr>
  ` : '';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Crestwell AI <noreply@crestwellgetaways.com>',
      to:   'info@crestwellgetaways.com',
      subject: `[${stage}] ${lead.first_name} ${lead.last_name} — Score ${score}/100`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
          <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:24px 32px;border-radius:8px 8px 0 0;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <h1 style="color:#ffffff;font-size:20px;margin:0;">New Lead — AI Qualified</h1>
                <p style="color:#94a3b8;font-size:13px;margin:4px 0 0;">Crestwell Travel Services</p>
              </div>
              <div>
                <span style="background:${color};color:#ffffff;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;">${stage}</span>
              </div>
            </div>
          </div>

          <div style="padding:24px 32px;">
            <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Lead Quality Score</p>
              <p style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">${score}/100</p>
              <p style="margin:8px 0 0;font-family:monospace;font-size:12px;color:${color};">${scoreDisplay}</p>
              <p style="margin:12px 0 0;font-size:14px;color:#475569;">${summary}</p>
            </div>

            <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#3b82f6;text-transform:uppercase;">Recommended Next Action</p>
              <p style="margin:0;font-size:14px;color:#1e40af;">${next_action}</p>
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              ${detailRows}
              ${messageRow}
            </table>

            <div style="margin-top:24px;text-align:center;">
              <a href="mailto:${lead.email}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Reply to ${lead.first_name}</a>
              ${lead.phone ? `<a href="tel:${lead.phone}" style="display:inline-block;background:#10b981;color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-left:12px;">Call ${lead.first_name}</a>` : ''}
            </div>
          </div>

          <div style="background:#f8fafc;padding:16px 32px;border-radius:0 0 8px 8px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Scored by Crestwell AI · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        </div>
      `,
    }),
  });

  return new Response(JSON.stringify({
    success: true,
    lead_id,
    score,
    stage,
    summary,
    next_action,
    tags,
    wants_financing,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
