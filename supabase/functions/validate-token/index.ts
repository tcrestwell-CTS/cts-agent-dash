import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizeLinkType(value: unknown): 'payment' | 'financing' {
  const normalized = String(value ?? '').toLowerCase();
  return normalized === 'financing' ? 'financing' : 'payment';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { token, link_type, mark_used = false } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ valid: false, reason: 'No token provided' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // secure_links is only readable by service_role (RLS has no anon/authenticated
    // policy). Using the anon key here made EVERY token resolve to "Invalid link".
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: link, error } = await supabase
      .from('secure_links')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !link) {
      return new Response(JSON.stringify({ valid: false, reason: 'Invalid link' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!link.active) {
      return new Response(JSON.stringify({ valid: false, reason: 'This link has been deactivated' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, reason: 'This link has expired' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (link.single_use && link.used_at) {
      return new Response(JSON.stringify({ valid: false, reason: 'This link has already been used' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guard against double-payment: if this link is tied to a specific
    // installment that has already been settled, refuse it even though the
    // link itself is still active/unexpired. Old reminder emails were the
    // main way a client could pay the same installment twice.
    if (link.trip_payment_id) {
      const { data: linkedPayment } = await supabase
        .from('trip_payments')
        .select('status')
        .eq('id', link.trip_payment_id)
        .maybeSingle();

      if (linkedPayment && String(linkedPayment.status).toLowerCase() === 'paid') {
        await supabase.from('secure_links').update({ active: false }).eq('token', token);
        return new Response(JSON.stringify({
          valid: false,
          reason: 'This payment has already been received. No further payment is due on this link.',
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (link_type) {
      const requestedType = normalizeLinkType(link_type);
      const storedType = normalizeLinkType(link.link_type);

      if (storedType !== requestedType) {
        return new Response(JSON.stringify({ valid: false, reason: 'Invalid link type' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (mark_used && !link.used_at) {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
      await supabase.from('secure_links').update({
        used_at: new Date().toISOString(),
        used_ip: ip,
      }).eq('token', token);
    }

    return new Response(JSON.stringify({
      valid: true,
      link_type: normalizeLinkType(link.link_type),
      payment_type: link.payment_type || 'custom',
      client_name: link.client_name,
      client_email: link.client_email,
      booking_ref: link.booking_ref,
      trip_name: link.trip_name,
      amount: link.amount,
      expires_at: link.expires_at,
      // Needed by the agent-branded pay page to correctly attribute the
      // payment (Stripe metadata + real trip_payments row), not just the
      // snapshot data above.
      agent_user_id: link.agent_user_id ?? null,
      trip_payment_id: link.trip_payment_id ?? null,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ valid: false, reason: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});