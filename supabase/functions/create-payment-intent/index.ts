import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logPaymentAttempt } from '../_shared/payment-ip-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      amount_cents: requestedAmountCents,
      currency = 'usd',
      customer_name,
      customer_email,
      customer_phone,
      booking_ref,
      trip_name,
      payment_type,
      notes,
      // CRM-linked fields (passed when available from token-gated payment page)
      trip_payment_id: passedTripPaymentId,
      trip_id: passedTripId,
      agent_user_id: passedAgentUserId,
      booking_id: passedBookingId,
    } = await req.json();

    let amount_cents = Number(requestedAmountCents);

    // Fire-and-forget attempt audit
    logPaymentAttempt(req, {
      page: 'create-payment-intent',
      outcome: 'attempted',
      amount_cents,
      currency,
      customer_email,
      booking_id: passedBookingId || null,
      trip_id: passedTripId || null,
    });

    if (!amount_cents || amount_cents < 50) {
      logPaymentAttempt(req, {
        page: 'create-payment-intent',
        outcome: 'blocked',
        amount_cents,
        customer_email,
        metadata: { reason: 'amount_below_minimum' },
      });
      return new Response(JSON.stringify({ error: 'Minimum payment is $0.50' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY_CLIENT');
    if (!STRIPE_SECRET_KEY) throw new Error('Stripe secret key not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // A payment link tied to an installment must always charge the authoritative
    // database amount. This also protects older/cached clients from accidentally
    // sending a dollar value where Stripe expects cents.
    if (passedTripPaymentId) {
      const { data: linkedPayment, error: linkedPaymentError } = await supabase
        .from('trip_payments')
        .select('amount')
        .eq('id', passedTripPaymentId)
        .maybeSingle();

      if (linkedPaymentError) throw linkedPaymentError;
      const linkedAmount = Number(linkedPayment?.amount);
      if (Number.isFinite(linkedAmount) && linkedAmount > 0) {
        amount_cents = Math.round(linkedAmount * 100);
      }
    }

    if (!Number.isInteger(amount_cents) || amount_cents < 50) {
      return new Response(JSON.stringify({ error: 'Minimum payment is $0.50' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── CRM lookup ────────────────────────────────────────────────────────────
    // Try to find trip_payment_id, trip_id, agent_user_id from CRM
    // Priority: passed params > lookup by email > unattributed
    let tripPaymentId  = passedTripPaymentId  || null;
    let tripId         = passedTripId         || null;
    let agentUserId    = passedAgentUserId     || null;
    let bookingId      = passedBookingId       || null;
    let resolvedType   = payment_type         || 'deposit';

    if ((!tripPaymentId || !tripId) && customer_email) {
      // Look up client by email → trips → next pending trip_payment
      const { data: client } = await supabase
        .from('clients')
        .select('id, user_id')
        .ilike('email', customer_email.trim())
        .maybeSingle();

      if (client) {
        agentUserId = agentUserId || client.user_id;

        // Find this client's trips, then next pending installment
        const { data: trips } = await supabase
          .from('trips')
          .select('id')
          .eq('client_id', client.id);

        const tripIds = (trips || []).map((t: any) => t.id);

        let tripPayment: any = null;
        if (tripIds.length > 0) {
          const amountDollars = amount_cents / 100;
          const tolerance = 5.00; // within $5 tolerance for amount matching

          // First try: exact or close amount match
          const { data: exactMatch } = await supabase
            .from('trip_payments')
            .select('id, trip_id, booking_id, amount, status, due_date')
            .eq('status', 'pending')
            .in('trip_id', tripIds)
            .gte('amount', amountDollars - tolerance)
            .lte('amount', amountDollars + tolerance)
            .order('due_date', { ascending: true })
            .limit(1);

          let resolved = exactMatch && exactMatch.length > 0 ? exactMatch[0] : null;

          // Fallback: any next pending installment if no amount match
          if (!resolved) {
            const { data: fallbackData } = await supabase
              .from('trip_payments')
              .select('id, trip_id, booking_id, amount, status, due_date')
              .eq('status', 'pending')
              .in('trip_id', tripIds)
              .order('due_date', { ascending: true })
              .limit(1);
            resolved = fallbackData && fallbackData.length > 0 ? fallbackData[0] : null;
          }

          tripPayment = resolved;
        }

        if (tripPayment) {
          tripPaymentId = tripPaymentId || tripPayment.id;
          tripId        = tripId        || tripPayment.trip_id;
          bookingId     = bookingId     || tripPayment.booking_id;
          resolvedType  = 'trip_installment';
          console.log(`[create-payment-intent] CRM match: trip_payment=${tripPaymentId} trip=${tripId}`);
        }
      }
    }

    // If still no CRM match — mark as unattributed so webhook routes to clearing queue
    if (!tripPaymentId && !tripId) {
      resolvedType = 'unattributed_deposit';
      console.log(`[create-payment-intent] No CRM match for ${customer_email} — marking unattributed`);
    }

    // ── Build Stripe PI metadata ──────────────────────────────────────────────
    const metadata: Record<string, string> = {
      payment_type:    resolvedType,
      customer_name:   customer_name  || '',
      customer_email:  customer_email || '',
      customer_phone:  customer_phone || '',
      booking_ref:     booking_ref    || '',
      trip_name:       trip_name      || '',
    };

    // CRM-compliant fields — only stamp if we have them
    if (tripPaymentId) metadata.trip_payment_id = tripPaymentId;
    if (tripId)        metadata.trip_id         = tripId;
    if (agentUserId)   metadata.agent_user_id   = agentUserId;
    if (bookingId)     metadata.booking_id      = bookingId;

    // ── Create Stripe PaymentIntent ───────────────────────────────────────────
    const piParams = new URLSearchParams({
      amount:   String(amount_cents),
      currency,
      // Allow redirect-capable methods so Link / Instant Bank Payments can appear.
      'automatic_payment_methods[enabled]':        'true',
      'automatic_payment_methods[allow_redirects]': 'always',
      description: trip_name
        ? `Crestwell Travel – ${trip_name}${booking_ref ? ` (Ref: ${booking_ref})` : ''}`
        : `Crestwell Travel Payment${booking_ref ? ` – Ref: ${booking_ref}` : ''}`,
    });
    // Bank/ACH explicitly excluded, per request -- multi-day settlement
    // isn't appropriate here. Everything else dynamic (card, Klarna,
    // Amazon Pay, etc.) still appears automatically.
    piParams.append('excluded_payment_method_types[]', 'us_bank_account');

    // Stripe rejects an empty/invalid receipt_email — only send a real address
    const cleanEmail = (customer_email || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      piParams.append('receipt_email', cleanEmail);
    }


    // Append metadata
    Object.entries(metadata).forEach(([k, v]) => {
      if (v) piParams.append(`metadata[${k}]`, v);
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: piParams,
    });

    const paymentIntent = await stripeRes.json();
    if (paymentIntent.error) throw new Error(paymentIntent.error.message);

    logPaymentAttempt(req, {
      page: 'create-payment-intent',
      outcome: 'succeeded',
      amount_cents,
      currency,
      customer_email,
      booking_id: bookingId || null,
      trip_id: tripId || null,
      stripe_payment_intent_id: paymentIntent.id,
    });

    // ── Write to checkout_payments with full context ───────────────────────────
    await supabase.from('checkout_payments').insert({
      customer_name:             customer_name  || 'Unknown',
      customer_email:            customer_email || '',
      customer_phone:            customer_phone || null,
      amount_cents,
      currency,
      payment_method:            'stripe',
      payment_type:              resolvedType,
      booking_ref:               booking_ref    || null,
      trip_name:                 trip_name      || null,
      notes:                     notes          || null,
      status:                    'pending',
      stripe_payment_intent_id:  paymentIntent.id,
      // CRM links
      trip_payment_id:           tripPaymentId  || null,
      trip_id:                   tripId         || null,
      agent_user_id:             agentUserId    || null,
      booking_id:                bookingId      || null,
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, amountCents: paymentIntent.amount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[create-payment-intent] Error:', err.message);
    logPaymentAttempt(req, {
      page: 'create-payment-intent',
      outcome: 'failed',
      metadata: { error: err?.message },
    });
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
