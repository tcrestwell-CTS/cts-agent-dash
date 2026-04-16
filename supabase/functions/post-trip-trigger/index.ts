import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

/**
 * post-trip-trigger
 * Runs daily — finds trips where return_date has passed and
 * post_trip_email_sent = false, then calls post-trip-email for each.
 * Secured by x-agent-secret header.
 */

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const AGENT_SECRET = Deno.env.get('AGENT_SECRET') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const secret = req.headers.get('x-agent-secret');
  if (AGENT_SECRET && secret !== AGENT_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const today = new Date().toISOString().split('T')[0];

  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, user_id, client_id, trip_name, destination, return_date, status')
    .lt('return_date', today)
    .eq('post_trip_email_sent', false)
    .not('status', 'in', '("cancelled","archived")')
    .not('client_id', 'is', null)
    .order('return_date', { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
  }

  if (!trips?.length) {
    return new Response(JSON.stringify({ processed: 0, message: 'No trips to follow up' }), { headers: CORS });
  }

  console.log(`Found ${trips.length} trips needing post-trip follow-up`);

  const results: any[] = [];
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  for (const trip of trips) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/post-trip-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
        },
        body: JSON.stringify({ record: trip }),
      });
      const data = await res.json();
      results.push({ trip_id: trip.id, trip_name: trip.trip_name, status: res.ok ? 'sent' : 'failed', ...data });
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      results.push({ trip_id: trip.id, trip_name: trip.trip_name, status: 'error', error: err.message });
    }
  }

  const sent = results.filter(r => r.status === 'sent').length;
  return new Response(JSON.stringify({ processed: trips.length, sent, failed: results.length - sent, results }), { headers: CORS });
});
