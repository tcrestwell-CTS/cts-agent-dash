// supabase/functions/send-proposal/index.ts
//
// Sends a generated proposal to the lead via Resend and stamps the
// quote_requests row (proposal_status='sent', proposal_sent_at, proposal_expires_at,
// sequence_started=true, status='contacted').
//
// Auth: either an admin/office_admin user JWT (Authorization: Bearer <jwt>)
//       or the agent secret (x-agent-secret: $CW_AGENT_SECRET) for n8n/curl.
//
// Body: { lead_id: string, force?: boolean }
// Returns: { ok: true, link: string, expires_at: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!;
const RESEND_KEY    = Deno.env.get('RESEND_API_KEY')!;
const AGENT_SECRET  = Deno.env.get('CW_AGENT_SECRET') ?? '';
const PORTAL_BASE   = (Deno.env.get('PORTAL_BASE_URL') ?? 'https://crestwellgetaways.com').replace(/\/$/, '');
const FROM_EMAIL    = Deno.env.get('PROPOSAL_FROM_EMAIL') ?? 'tim@crestwellgetaways.com';
const FROM_NAME     = 'Tim at Crestwell';
const REPLY_TO      = 'info@crestwellgetaways.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function mdToHtml(md: string): string {
  // Minimal markdown → HTML. Keeps headings, bold, italics, lists, paragraphs.
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split(/\r?\n/);
  let html = '';
  let inList = false;
  const flushList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushList();
      const lvl = h[1].length;
      html += `<h${lvl} style="font-family:Georgia,serif;color:#0b2545;margin:24px 0 8px">${esc(h[2])}</h${lvl}>`;
      continue;
    }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      if (!inList) { html += '<ul style="margin:8px 0 16px 20px;color:#222;line-height:1.55">'; inList = true; }
      html += `<li>${esc(li[1]).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')}</li>`;
      continue;
    }
    flushList();
    let p = esc(line)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
    html += `<p style="margin:0 0 14px;color:#222;line-height:1.55">${p}</p>`;
  }
  flushList();
  return html;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // --- Auth: agent-secret OR admin/office_admin user JWT ---
    const agentHeader = req.headers.get('x-agent-secret') ?? '';
    const authHeader  = req.headers.get('Authorization') ?? '';
    let authorized = false;

    if (AGENT_SECRET && agentHeader && agentHeader === AGENT_SECRET) {
      authorized = true;
    } else if (authHeader.startsWith('Bearer ')) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
      if (!claimsErr && claims?.claims?.sub) {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data: roleRow } = await admin
          .from('user_roles')
          .select('role')
          .eq('user_id', claims.claims.sub)
          .in('role', ['admin', 'office_admin']);
        if (roleRow && roleRow.length > 0) authorized = true;
      }
    }

    if (!authorized) return json({ error: 'Unauthorized' }, 401);

    // --- Body ---
    const body = await req.json().catch(() => ({}));
    const lead_id: string | undefined = body?.lead_id;
    if (!lead_id || typeof lead_id !== 'string') {
      return json({ error: 'lead_id required' }, 400);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: lead, error: leadErr } = await sb
      .from('quote_requests')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) return json({ error: 'Lead not found' }, 404);
    if (!lead.proposal_draft) return json({ error: 'No proposal draft to send. Generate first.' }, 409);
    if (lead.proposal_status === 'approved' || lead.proposal_status === 'converted') {
      return json({ error: `Proposal already ${lead.proposal_status}; cannot resend.` }, 409);
    }

    // --- Compose ---
    const token = lead.proposal_token;
    if (!token) return json({ error: 'Lead missing proposal_token' }, 500);
    const link = `${PORTAL_BASE}/proposal/${token}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const tripBits = [lead.trip_type, lead.destination].filter(Boolean).join(' — ');
    const subject = `Your Crestwell proposal${tripBits ? `: ${tripBits}` : ''}`;

    const proposalHtml = mdToHtml(lead.proposal_draft);
    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f1ea;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;padding:32px 36px;border-top:6px solid #c9a84c">
    <h1 style="font-family:Georgia,serif;color:#0b2545;margin:0 0 6px;font-size:24px">Hi ${lead.first_name || 'there'},</h1>
    <p style="color:#555;margin:0 0 24px">Here's the proposal I put together for you. Take a look and let me know what you think.</p>
    <div style="text-align:center;margin:8px 0 28px">
      <a href="${link}" style="display:inline-block;background:#0b2545;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:600;letter-spacing:.3px">View &amp; approve your proposal</a>
    </div>
    <hr style="border:0;border-top:1px solid #eee;margin:24px 0">
    ${proposalHtml}
    <hr style="border:0;border-top:1px solid #eee;margin:28px 0 16px">
    <p style="color:#555;margin:0 0 6px">When you're ready, the easiest next step is to <a href="${link}" style="color:#0b2545">approve online</a>. The link is good for 7 days.</p>
    <p style="color:#555;margin:16px 0 0">— Tim Crestwell<br/>Crestwell Travel Services · 888.508.6893</p>
  </div>
</body></html>`;

    // --- Send via Resend ---
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [lead.email],
        reply_to: REPLY_TO,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend send failed:', resendRes.status, errText);
      return json({ error: 'Email send failed', detail: errText }, 502);
    }

    // --- Update lead ---
    const updates: Record<string, unknown> = {
      proposal_status: 'sent',
      proposal_sent_at: new Date().toISOString(),
      proposal_expires_at: expiresAt,
      sequence_started: true,
    };
    if (lead.status === 'new' || !lead.status) updates.status = 'contacted';

    const { error: updErr } = await sb.from('quote_requests').update(updates).eq('id', lead_id);
    if (updErr) {
      console.error('quote_requests update failed:', updErr);
      return json({ ok: true, link, expires_at: expiresAt, warning: 'Email sent but lead row update failed' });
    }

    console.log(`Proposal sent for lead ${lead_id} → ${lead.email}`);
    return json({ ok: true, link, expires_at: expiresAt });
  } catch (e) {
    console.error('send-proposal error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});