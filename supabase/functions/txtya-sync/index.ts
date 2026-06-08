// TxtYa Travels sync edge function
// Pushes a trip + traveler (primary client or companion) to TxtYa
// POST body: { trip_id: string, traveler_kind: 'primary' | 'companion', companion_id?: string }
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TXTYA_ENDPOINT = 'https://travels.txtya.com/api/integrations/bookings';

interface SyncRequest {
  trip_id: string;
  traveler_kind: 'primary' | 'companion';
  companion_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const apiKey = Deno.env.get('TXTYA_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'TXTYA_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = (await req.json()) as SyncRequest;
    if (!body?.trip_id || !body?.traveler_kind) {
      return new Response(
        JSON.stringify({ error: 'trip_id and traveler_kind are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Load trip
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('id, trip_name, destination, departure_date, return_date, client_id, user_id')
      .eq('id', body.trip_id)
      .single();
    if (tripErr || !trip) throw new Error(`Trip not found: ${tripErr?.message}`);

    // Check per-agency toggle
    const { data: settings } = await supabase
      .from('agency_settings')
      .select('txtya_enabled, txtya_default_group_id')
      .eq('user_id', trip.user_id)
      .maybeSingle();

    if (!settings?.txtya_enabled) {
      await supabase.from('txtya_sync_log').insert({
        trip_id: trip.id,
        traveler_kind: body.traveler_kind,
        companion_id: body.companion_id ?? null,
        status: 'skipped',
        error_message: 'TxtYa disabled for this agency',
      });
      return new Response(
        JSON.stringify({ skipped: true, reason: 'txtya disabled for agency' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Resolve traveler
    let travelerName = '';
    let travelerEmail: string | null = null;
    let travelerPhone: string | null = null;
    let clientId: string | null = null;
    let companionId: string | null = null;

    if (body.traveler_kind === 'primary') {
      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .eq('id', trip.client_id)
        .single();
      if (clientErr || !client) throw new Error(`Client not found: ${clientErr?.message}`);
      clientId = client.id;
      travelerName = client.name;
      travelerEmail = client.email;
      travelerPhone = client.phone;
    } else {
      if (!body.companion_id) throw new Error('companion_id required for companion sync');
      const { data: companion, error: compErr } = await supabase
        .from('client_companions')
        .select('id, first_name, last_name, email, phone')
        .eq('id', body.companion_id)
        .single();
      if (compErr || !companion) throw new Error(`Companion not found: ${compErr?.message}`);
      companionId = companion.id;
      travelerName = `${companion.first_name ?? ''} ${companion.last_name ?? ''}`.trim();
      travelerEmail = companion.email;
      travelerPhone = companion.phone;
    }

    // Build TxtYa payload
    const payload: Record<string, unknown> = {
      trip: {
        bookingRef: trip.id,
        name: trip.trip_name,
        destination: trip.destination,
        startDate: trip.departure_date,
        endDate: trip.return_date,
      },
      traveler: {
        name: travelerName || 'Traveler',
        email: travelerEmail,
        phone: travelerPhone,
      },
    };
    if (settings.txtya_default_group_id) {
      payload.group_id = settings.txtya_default_group_id;
    }

    const res = await fetch(TXTYA_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await res.json().catch(() => ({}));

    const logRow = {
      trip_id: trip.id,
      client_id: clientId,
      companion_id: companionId,
      traveler_kind: body.traveler_kind,
      txtya_traveler_id: responseBody?.traveler?.id?.toString() ?? null,
      txtya_trip_id: responseBody?.trip?.id?.toString() ?? null,
      status: res.ok ? 'success' : 'error',
      error_message: res.ok ? null : (responseBody?.error || `HTTP ${res.status}`),
      request_payload: payload,
      response_payload: responseBody,
    };
    await supabase.from('txtya_sync_log').insert(logRow);

    return new Response(JSON.stringify({ ok: res.ok, response: responseBody }), {
      status: res.ok ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('txtya-sync error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});