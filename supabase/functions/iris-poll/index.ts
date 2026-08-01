// Iris — Inbox watcher agent.
// Polls connected Gmail mailbox(es), classifies new messages with Lovable AI,
// and posts proposed actions into ai_proposed_actions for the agent inbox.
//
// Modes:
//   POST {}                       — process all active watched mailboxes (cron)
//   POST { mailbox_id: "uuid" }   — process a single mailbox (manual sync)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireInternalOrUser } from '../_shared/internal-auth.ts';

const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const GMAIL_KEY = Deno.env.get('GOOGLE_MAIL_API_KEY') ?? '';
const GATEWAY = 'https://connector-gateway.lovable.dev/google_mail/gmail/v1';
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: CORS });

type Mailbox = {
  id: string;
  user_id: string;
  provider: string;
  email_address: string | null;
  last_synced_at: string | null;
};

type GmailMessage = {
  id: string;
  threadId: string;
  payload?: {
    headers?: { name: string; value: string }[];
    parts?: any[];
    body?: { data?: string };
    mimeType?: string;
  };
  snippet?: string;
  internalDate?: string;
};

function gmailFetch(path: string, init: RequestInit = {}) {
  return fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GMAIL_KEY,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function b64urlDecode(s: string): string {
  try {
    const norm = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm + '==='.slice((norm.length + 3) % 4);
    return new TextDecoder().decode(
      Uint8Array.from(atob(pad), (c) => c.charCodeAt(0)),
    );
  } catch {
    return '';
  }
}

function extractBody(msg: GmailMessage): string {
  const walk = (p: any): string => {
    if (!p) return '';
    if (p.mimeType === 'text/plain' && p.body?.data) return b64urlDecode(p.body.data);
    if (p.parts) {
      for (const c of p.parts) {
        const t = walk(c);
        if (t) return t;
      }
    }
    if (p.body?.data) return b64urlDecode(p.body.data);
    return '';
  };
  return walk(msg.payload).slice(0, 4000) || msg.snippet || '';
}

function headerMap(msg: GmailMessage): Record<string, string> {
  const h: Record<string, string> = {};
  for (const x of msg.payload?.headers ?? []) h[x.name.toLowerCase()] = x.value;
  return h;
}

function parseFrom(raw: string): { email: string; name: string } {
  const m = raw.match(/^"?(.*?)"?\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: raw.trim().toLowerCase() };
}

type Classification = {
  category:
    | 'lead_reply'
    | 'client_reply'
    | 'supplier_confirmation'
    | 'supplier_update'
    | 'payment_notice'
    | 'newsletter'
    | 'spam'
    | 'other';
  confidence: number;
  summary: string;
  suggested_action:
    | 'draft_reply'
    | 'attach_confirmation'
    | 'create_note'
    | 'flag_booking_at_risk'
    | 'none';
  draft?: { subject?: string; body?: string };
  confirmation_number?: string;
};

async function classify(
  subject: string,
  from: string,
  body: string,
): Promise<Classification> {
  const prompt = `You are Iris, an AI inbox triage agent for Crestwell Travel Services.
Classify this email and propose ONE action.

Return strict JSON:
{
  "category": "lead_reply"|"client_reply"|"supplier_confirmation"|"supplier_update"|"payment_notice"|"newsletter"|"spam"|"other",
  "confidence": 0.0-1.0,
  "summary": "one sentence summary",
  "suggested_action": "draft_reply"|"attach_confirmation"|"create_note"|"flag_booking_at_risk"|"none",
  "draft": { "subject": "...", "body": "..." },   // only if suggested_action == draft_reply
  "confirmation_number": "ABC123"                 // only if attach_confirmation
}

EMAIL:
From: ${from}
Subject: ${subject}

${body}`;

  const res = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(text);
  } catch {
    return {
      category: 'other',
      confidence: 0.3,
      summary: 'Unable to classify',
      suggested_action: 'none',
    };
  }
}

async function findLinkedRecords(
  db: ReturnType<typeof createClient>,
  userId: string,
  fromEmail: string,
) {
  const result: { lead_id?: string; trip_id?: string; booking_id?: string } = {};
  const { data: lead } = await db
    .from('quote_requests')
    .select('id')
    .eq('email', fromEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lead) result.lead_id = (lead as any).id;

  const { data: client } = await db
    .from('clients')
    .select('id')
    .eq('email', fromEmail)
    .maybeSingle();
  if (client) {
    const { data: trip } = await db
      .from('trips')
      .select('id')
      .eq('client_id', (client as any).id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (trip) result.trip_id = (trip as any).id;
  }
  return result;
}

async function processMailbox(
  db: ReturnType<typeof createClient>,
  mb: Mailbox,
): Promise<{ processed: number; proposed: number; errors: number }> {
  const sinceSec = mb.last_synced_at
    ? Math.floor(new Date(mb.last_synced_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - 60 * 60 * 24; // default 24h
  const q = encodeURIComponent(`in:inbox -category:promotions -category:social after:${sinceSec}`);
  const listRes = await gmailFetch(`/users/me/messages?maxResults=25&q=${q}`);
  if (!listRes.ok) {
    const err = await listRes.text();
    console.error('Gmail list failed', listRes.status, err);
    return { processed: 0, proposed: 0, errors: 1 };
  }
  const list = await listRes.json();
  const ids: string[] = (list.messages ?? []).map((m: any) => m.id);
  let processed = 0,
    proposed = 0,
    errors = 0;

  for (const mid of ids) {
    // Skip if we've seen it
    const { data: seen } = await db
      .from('inbox_processed_messages')
      .select('id')
      .eq('user_id', mb.user_id)
      .eq('provider', mb.provider)
      .eq('provider_message_id', mid)
      .maybeSingle();
    if (seen) continue;

    try {
      const mr = await gmailFetch(`/users/me/messages/${mid}?format=full`);
      if (!mr.ok) {
        errors++;
        continue;
      }
      const msg: GmailMessage = await mr.json();
      const h = headerMap(msg);
      const { email, name } = parseFrom(h.from ?? '');
      const subject = h.subject ?? '(no subject)';
      const body = extractBody(msg);
      const received = msg.internalDate
        ? new Date(parseInt(msg.internalDate)).toISOString()
        : new Date().toISOString();

      const cls = await classify(subject, email, body);
      const links = await findLinkedRecords(db, mb.user_id, email);

      let proposedActionId: string | null = null;
      if (cls.suggested_action && cls.suggested_action !== 'none') {
        const action_type = cls.suggested_action;
        const target_table = links.booking_id
          ? 'bookings'
          : links.trip_id
            ? 'trips'
            : links.lead_id
              ? 'quote_requests'
              : null;
        const target_id =
          links.booking_id ?? links.trip_id ?? links.lead_id ?? null;

        const changes: Record<string, unknown> = {
          email_from: email,
          email_subject: subject,
          provider_message_id: mid,
          thread_id: msg.threadId,
        };
        if (action_type === 'draft_reply' && cls.draft) {
          changes.subject = cls.draft.subject;
          changes.body = cls.draft.body;
        }
        if (action_type === 'attach_confirmation' && cls.confirmation_number) {
          changes.confirmation_number = cls.confirmation_number;
        }
        if (action_type === 'create_note' || action_type === 'flag_booking_at_risk') {
          changes.title = `Iris: ${cls.category.replace(/_/g, ' ')}`;
          changes.message = cls.summary;
        }

        const { data: ins, error: insErr } = await db
          .from('ai_proposed_actions')
          .insert({
            user_id: mb.user_id,
            agent_name: 'iris',
            action_type,
            target_table,
            target_id,
            summary: `${cls.category.replace(/_/g, ' ')} from ${name || email}: ${cls.summary}`,
            reasoning: cls.summary,
            proposed_changes: changes,
            source: `gmail:${mid}`,
            status: 'pending',
            confidence: cls.confidence,
          })
          .select('id')
          .single();
        if (insErr) {
          console.error('Insert proposed action failed', insErr);
          errors++;
        } else {
          proposedActionId = (ins as any).id;
          proposed++;
        }
      }

      await db.from('inbox_processed_messages').insert({
        user_id: mb.user_id,
        provider: mb.provider,
        provider_message_id: mid,
        thread_id: msg.threadId,
        from_email: email,
        from_name: name,
        subject,
        received_at: received,
        classification: cls.category,
        // Keep the message text for supplier confirmations so agents can turn it
        // into itinerary items without re-pasting the email.
        body_text:
          cls.category === 'supplier_confirmation' || cls.category === 'supplier_update'
            ? (body || '').slice(0, 50000)
            : null,
        linked_lead_id: links.lead_id ?? null,
        linked_trip_id: links.trip_id ?? null,
        linked_booking_id: links.booking_id ?? null,
        proposed_action_id: proposedActionId,
      });
      processed++;
    } catch (e) {
      console.error('Process message error', mid, e);
      errors++;
    }
  }

  await db
    .from('inbox_watched_mailboxes')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', mb.id);

  return { processed, proposed, errors };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // Auth: internal cron (service role or x-agent-secret) or signed-in user
  const auth = await requireInternalOrUser(req, CORS);
  if (auth instanceof Response) return auth;

  if (!LOVABLE_API_KEY || !GMAIL_KEY) {
    return json({ error: 'Gmail connector not linked' }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const mailbox_id = body?.mailbox_id as string | undefined;

  const db = createClient(SUPA_URL, SUPA_SVC);
  let query = db
    .from('inbox_watched_mailboxes')
    .select('id, user_id, provider, email_address, last_synced_at')
    .eq('is_active', true);
  if (mailbox_id) query = query.eq('id', mailbox_id);

  const { data: mailboxes, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const results: any[] = [];
  for (const mb of (mailboxes ?? []) as Mailbox[]) {
    const r = await processMailbox(db, mb);
    results.push({ mailbox_id: mb.id, ...r });
  }
  return json({ ok: true, mailboxes: results.length, results });
});