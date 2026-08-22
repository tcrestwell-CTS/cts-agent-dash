// supabase/functions/agent-billing/index.ts
// Advisor self-service billing: lets an advisor update the card used for their
// subscription (Stripe Billing Portal, with a Checkout "setup mode" fallback)
// and refresh the stored card summary on agent_subscriptions.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STRIPE_BASE = 'https://api.stripe.com/v1';

async function stripeReq(
  method: 'GET' | 'POST',
  endpoint: string,
  secretKey: string,
  data?: Record<string, string>,
) {
  const res = await fetch(`${STRIPE_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? new URLSearchParams(data ?? {}) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error?.message || 'Stripe request failed');
    (err as any).stripeCode = json.error?.code;
    throw err;
  }
  return json;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'Billing is not configured yet.' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'Not authenticated' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.email) return json({ error: 'Not authenticated' }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'sync_payment_method');
    const returnUrl = typeof body.return_url === 'string' && body.return_url.startsWith('http')
      ? body.return_url
      : 'https://app.crestwelltravels.com/settings';

    // ── Load (or create) the advisor's subscription row ──────────────────────
    const { data: existing } = await admin
      .from('agent_subscriptions')
      .select('*')
      .eq('agent_user_id', user.id)
      .maybeSingle();

    let sub = existing;
    if (!sub) {
      const { data: created, error: createErr } = await admin
        .from('agent_subscriptions')
        .insert({ agent_user_id: user.id, status: 'pending' })
        .select('*')
        .single();
      if (createErr) throw createErr;
      sub = created;
    }

    // ── Ensure a Stripe customer exists for this advisor ─────────────────────
    let customerId: string | null = sub.stripe_customer_id ?? null;
    if (!customerId) {
      const search = await stripeReq(
        'GET',
        `/customers?email=${encodeURIComponent(user.email!)}&limit=1`,
        stripeKey,
      );
      customerId = search.data?.[0]?.id ?? null;
    }
    if (!customerId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const customer = await stripeReq('POST', '/customers', stripeKey, {
        email: user.email!,
        name: profile?.full_name || user.email!,
        'metadata[agent_user_id]': user.id,
        'metadata[customer_type]': 'advisor_subscription',
      });
      customerId = customer.id;
    }
    if (customerId !== sub.stripe_customer_id) {
      await admin
        .from('agent_subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('id', sub.id);
    }

    // ── Actions ─────────────────────────────────────────────────────────────
    if (action === 'update_payment_method') {
      // Preferred: Stripe-hosted billing portal (card + invoices in one place).
      try {
        const portal = await stripeReq('POST', '/billing_portal/sessions', stripeKey, {
          customer: customerId!,
          return_url: returnUrl,
        });
        return json({ url: portal.url, mode: 'portal' });
      } catch (portalErr) {
        console.log('[agent-billing] portal unavailable, falling back to setup checkout', String(portalErr));
      }

      // Fallback: Checkout in setup mode saves a new card to the customer.
      const session = await stripeReq('POST', '/checkout/sessions', stripeKey, {
        mode: 'setup',
        customer: customerId!,
        'payment_method_types[0]': 'card',
        success_url: `${returnUrl}?billing=updated`,
        cancel_url: `${returnUrl}?billing=cancelled`,
        'metadata[agent_user_id]': user.id,
      });
      return json({ url: session.url, mode: 'setup' });
    }

    if (action === 'sync_payment_method') {
      const customer = await stripeReq('GET', `/customers/${customerId}`, stripeKey);
      let pmId: string | null = customer.invoice_settings?.default_payment_method ?? null;

      if (!pmId) {
        const pms = await stripeReq(
          'GET',
          `/payment_methods?customer=${customerId}&type=card&limit=1`,
          stripeKey,
        );
        pmId = pms.data?.[0]?.id ?? null;
        // Make it the default so future invoices use it.
        if (pmId) {
          await stripeReq('POST', `/customers/${customerId}`, stripeKey, {
            'invoice_settings[default_payment_method]': pmId,
          }).catch(() => {});
        }
      }

      let update: Record<string, unknown> = {
        payment_method_brand: null,
        payment_method_last4: null,
        payment_method_exp: null,
      };

      if (pmId) {
        const pm = await stripeReq('GET', `/payment_methods/${pmId}`, stripeKey);
        update = {
          payment_method_brand: pm.card?.brand ?? null,
          payment_method_last4: pm.card?.last4 ?? null,
          payment_method_exp: pm.card
            ? `${String(pm.card.exp_month).padStart(2, '0')}/${String(pm.card.exp_year).slice(-2)}`
            : null,
        };
      }

      // Pick up live Stripe subscription details when one exists.
      const subs = await stripeReq(
        'GET',
        `/subscriptions?customer=${customerId}&status=active&limit=1`,
        stripeKey,
      ).catch(() => ({ data: [] }));
      const liveSub = subs.data?.[0];
      if (liveSub) {
        update.stripe_subscription_id = liveSub.id;
        update.status = 'active';
        if (liveSub.current_period_end) {
          update.next_billing_date = new Date(liveSub.current_period_end * 1000)
            .toISOString()
            .slice(0, 10);
        }
        const item = liveSub.items?.data?.[0];
        if (item?.price?.unit_amount != null) {
          update.amount = item.price.unit_amount / 100;
          const interval = item.price.recurring?.interval;
          if (interval) update.billing_interval = interval === 'year' ? 'yearly' : 'monthly';
        }
      }

      const { data: saved, error: saveErr } = await admin
        .from('agent_subscriptions')
        .update(update)
        .eq('id', sub.id)
        .select('*')
        .single();
      if (saveErr) throw saveErr;

      return json({ subscription: saved });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error('[agent-billing] error', error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
