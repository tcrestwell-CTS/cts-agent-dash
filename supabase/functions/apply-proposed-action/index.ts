// Apply a proposed AI action from the Approval Inbox.
// Single chokepoint: every agent posts to ai_proposed_actions, this function applies the change.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPA_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

type Action = {
  id: string;
  user_id: string;
  agent_name: string;
  action_type: string;
  target_table: string | null;
  target_id: string | null;
  proposed_changes: Record<string, unknown>;
  status: string;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  // Auth: validate caller
  const userClient = createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error: claimErr } = await userClient.auth.getClaims(token);
  if (claimErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
  const caller_id = claims.claims.sub as string;

  const body = await req.json().catch(() => ({}));
  const action_id = body?.action_id as string | undefined;
  const decision = (body?.decision as string | undefined) ?? 'approve'; // approve | reject
  if (!action_id) return json({ error: 'action_id required' }, 400);

  const db = createClient(SUPA_URL, SUPA_SVC);

  const { data: action, error: loadErr } = await db
    .from('ai_proposed_actions')
    .select('*')
    .eq('id', action_id)
    .maybeSingle<Action>();

  if (loadErr || !action) return json({ error: 'Action not found' }, 404);
  if (action.status !== 'pending') return json({ error: `Action already ${action.status}` }, 409);

  // Permission: caller must own the action OR be admin/office_admin
  let allowed = action.user_id === caller_id;
  if (!allowed) {
    const { data: isAdmin } = await db.rpc('has_role', { _user_id: caller_id, _role: 'admin' });
    const { data: isOffice } = await db.rpc('has_role', { _user_id: caller_id, _role: 'office_admin' });
    allowed = !!isAdmin || !!isOffice;
  }
  if (!allowed) return json({ error: 'Forbidden' }, 403);

  if (decision === 'reject') {
    await db
      .from('ai_proposed_actions')
      .update({ status: 'rejected', approved_by: caller_id, approved_at: new Date().toISOString() })
      .eq('id', action_id);
    return json({ ok: true, status: 'rejected' });
  }

  // Dispatch by action_type
  try {
    await dispatch(db, action);
    await db
      .from('ai_proposed_actions')
      .update({
        status: 'applied',
        approved_by: caller_id,
        approved_at: new Date().toISOString(),
        applied_at: new Date().toISOString(),
      })
      .eq('id', action_id);
    return json({ ok: true, status: 'applied' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .from('ai_proposed_actions')
      .update({
        status: 'failed',
        approved_by: caller_id,
        approved_at: new Date().toISOString(),
        error_message: msg,
      })
      .eq('id', action_id);
    return json({ error: msg }, 500);
  }
});

async function dispatch(
  db: ReturnType<typeof createClient>,
  action: Action,
): Promise<void> {
  const changes = action.proposed_changes ?? {};
  switch (action.action_type) {
    case 'update_lead_status': {
      if (!action.target_id) throw new Error('target_id required');
      const { error } = await db
        .from('quote_requests')
        .update({ status: (changes as any).status, ai_stage: (changes as any).ai_stage })
        .eq('id', action.target_id);
      if (error) throw error;
      return;
    }
    case 'update_trip_dates': {
      if (!action.target_id) throw new Error('target_id required');
      const patch: Record<string, unknown> = {};
      if ((changes as any).departure_date) patch.departure_date = (changes as any).departure_date;
      if ((changes as any).return_date) patch.return_date = (changes as any).return_date;
      const { error } = await db.from('trips').update(patch).eq('id', action.target_id);
      if (error) throw error;
      return;
    }
    case 'create_note': {
      // Generic note appended to a target record's notes field, or inserted into agent_notifications
      const { error } = await db.from('agent_notifications').insert({
        user_id: action.user_id,
        type: 'ai_note',
        title: (changes as any).title ?? 'AI Note',
        message: (changes as any).message ?? '',
        trip_id: action.target_table === 'trips' ? action.target_id : null,
      });
      if (error) throw error;
      return;
    }
    case 'attach_confirmation': {
      if (!action.target_id) throw new Error('target_id required');
      const { error } = await db.from('bookings').update({
        confirmation_number: (changes as any).confirmation_number,
        supplier_confirmation_received_at: new Date().toISOString(),
      }).eq('id', action.target_id);
      if (error) throw error;
      return;
    }
    case 'flag_booking_at_risk': {
      if (!action.target_id) throw new Error('target_id required');
      const { error } = await db.from('agent_notifications').insert({
        user_id: action.user_id,
        type: 'booking_at_risk',
        title: (changes as any).title ?? 'Booking at risk',
        message: (changes as any).message ?? '',
      });
      if (error) throw error;
      return;
    }
    case 'draft_reply': {
      // Stored on the action itself — nothing to apply server-side beyond marking applied.
      // UI surfaces the draft for the agent to send via existing email flow.
      return;
    }
    default:
      throw new Error(`Unsupported action_type: ${action.action_type}`);
  }
}