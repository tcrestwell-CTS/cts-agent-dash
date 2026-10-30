// group-booking: public API behind the six-step group booking wizard
// (/group/:token/book). Companion to group-signup, which powers the simpler
// "join this trip" form on the landing page.
//
//   GET  ?token=<share_token>            → page config: trip, branding, advisor, cabin options
//                                          (with live availability), add-ons, included items, terms
//   POST { action:"quote", token, rooms, addons, promo_code }
//                                        → server-side price for the current selection
//   POST { action:"book",  token, rooms, addons, promo_code, contact, terms_accepted }
//                                        → validates, prices, creates client + sub-trip + booking +
//                                          trip_travelers + group_signups + group_bookings, then a
//                                          Stripe PaymentIntent for the deposit; returns clientSecret
//
// The Stripe webhook (payment_type = "group_deposit") marks the group_booking
// deposit_paid, writes a paid trip_payments row and confirms the booking.
//
// verify_jwt = false (public). Secrets: STRIPE_SECRET_KEY_CLIENT (new client Stripe account; publishable key is pinned
// in src/lib/stripePublishableKey.ts), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.


import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveAgentBranding } from '../_shared/agent-branding.ts';
import { sendGroupEventEmails } from '../_shared/group-emails.ts';
import { escapeHtml } from '../_shared/rentalEmail.ts';
import { checkRateLimit, getClientIP, rateLimitResponse } from '../_shared/rate-limiter.ts';
import { quoteBooking, type AddonPricing, type CabinOptionPricing, type RoomInput } from '../_shared/group-pricing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const TRIP_COLS =
  'id, user_id, trip_name, destination, depart_date, return_date, status, trip_type, cover_image_url, ' +
  'group_landing_enabled, booking_flow_enabled, group_landing_headline, group_landing_description, group_landing_content, ' +
  'ship_name, ship_name_display, depart_port, ports_of_call, taxes_fees_per_person, group_deposit_per_person, ' +
  'final_payment_due, group_included_items, group_terms, max_rooms_per_booking, promo_codes, currency';

async function loadTrip(token: string) {
  const supabase = admin();
  const { data: trip } = await supabase
    .from('trips')
    .select(TRIP_COLS)
    .eq('share_token', token)
    .eq('trip_type', 'group')
    .maybeSingle();
  if (!trip || !trip.group_landing_enabled || !trip.booking_flow_enabled) return null;

  const [{ data: options }, { data: addons }, { data: usage }, { data: branding }, { data: advisor }] = await Promise.all([
    supabase
      .from('trip_cabin_options')
      .select('id, category_group, category_name, description, price_per_person, price_period, deposit_amount, capacity, image_url, images, features, sqft, sleeps_min, sleeps_max, third_fourth_price, child_price, single_supplement_pct, inventory, sold_out, accessible_available, badge, sort_order')
      .eq('trip_id', trip.id)
      .order('sort_order'),
    supabase.from('trip_addons').select('id, name, description, price, price_basis, image_url, sort_order').eq('trip_id', trip.id).eq('enabled', true).order('sort_order'),
    supabase.rpc('group_cabin_option_usage', { p_trip_id: trip.id }),
    supabase.from('branding_settings').select('agency_name, logo_url, primary_color, accent_color, tagline, phone, email_address, website').eq('user_id', trip.user_id).maybeSingle(),
    supabase.from('profiles').select('full_name, avatar_url, agency_name, phone, clia_number, asta_number').eq('user_id', trip.user_id).maybeSingle(),
  ]);

  const taken = new Map<string, number>((usage ?? []).map((u: any) => [u.cabin_option_id, u.rooms_taken]));
  const cabinOptions = (options ?? []).map((o: any) => {
    const remaining = o.inventory == null ? null : Math.max(0, o.inventory - (taken.get(o.id) ?? 0));
    return { ...o, remaining, sold_out: o.sold_out || remaining === 0 };
  });

  return { trip, cabinOptions, addons: addons ?? [], branding, advisor };
}

function toPricingOption(o: any): CabinOptionPricing {
  return {
    id: o.id,
    category_group: o.category_group,
    category_name: o.category_name,
    price_per_person: Number(o.price_per_person),
    third_fourth_price: o.third_fourth_price == null ? null : Number(o.third_fourth_price),
    child_price: o.child_price == null ? null : Number(o.child_price),
    single_supplement_pct: Number(o.single_supplement_pct ?? 100),
    deposit_amount: o.deposit_amount == null ? null : Number(o.deposit_amount),
    sleeps_min: o.sleeps_min ?? 1,
    sleeps_max: o.sleeps_max ?? 2,
    sold_out: !!o.sold_out,
  };
}

function normalizeRooms(raw: unknown, maxRooms: number): RoomInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, maxRooms).map((r: any) => ({
    cabin_option_id: typeof r?.cabin_option_id === 'string' ? r.cabin_option_id : null,
    adults: Math.max(0, Math.min(4, Number(r?.adults) || 0)),
    children: Math.max(0, Math.min(3, Number(r?.children) || 0)),
    accessible: !!r?.accessible,
    guests: Array.isArray(r?.guests) ? r.guests : [],
  })) as any;
}

function validateRooms(rooms: RoomInput[], options: CabinOptionPricing[]): string | null {
  if (!rooms.length) return 'Add at least one room.';
  const byId = new Map(options.map((o) => [o.id, o]));
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    const guests = r.adults + r.children;
    if (r.adults < 1) return `Room ${i + 1} needs at least one adult.`;
    if (!r.cabin_option_id) return `Choose a stateroom for room ${i + 1}.`;
    const opt = byId.get(r.cabin_option_id);
    if (!opt) return `Room ${i + 1}: that stateroom is no longer offered.`;
    if (opt.sold_out) return `Room ${i + 1}: ${opt.category_name} is sold out.`;
    if (guests < opt.sleeps_min || guests > opt.sleeps_max) return `Room ${i + 1}: ${opt.category_name} sleeps ${opt.sleeps_min}-${opt.sleeps_max}.`;
  }
  return null;
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);

  // ── GET config ──
  if (req.method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) return json({ error: 'token required' }, 400);
    const cfg = await loadTrip(token);
    if (!cfg) return json({ error: 'This booking page is not available.' }, 404);
    return json({ ...cfg, stripe_publishable_key: null });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const token: string = body.token;
  if (!token) return json({ error: 'token required' }, 400);
  const cfg = await loadTrip(token);
  if (!cfg) return json({ error: 'This booking page is not available.' }, 404);
  const { trip } = cfg;

  const pricingOptions = cfg.cabinOptions.map(toPricingOption);
  const pricingAddons: AddonPricing[] = cfg.addons.map((a: any) => ({ id: a.id, name: a.name, price: Number(a.price), price_basis: a.price_basis }));
  const pricingCfg = {
    taxes_fees_per_person: Number(trip.taxes_fees_per_person ?? 0),
    group_deposit_per_person: trip.group_deposit_per_person == null ? null : Number(trip.group_deposit_per_person),
    promo_codes: Array.isArray(trip.promo_codes) ? trip.promo_codes : [],
  };
  const rooms = normalizeRooms(body.rooms, trip.max_rooms_per_booking ?? 4);
  const selectedAddons: { addon_id: string; quantity: number }[] = Array.isArray(body.addons)
    ? body.addons.map((a: any) => ({ addon_id: String(a.addon_id), quantity: Math.max(0, Number(a.quantity) || 0) }))
    : [];
  const promoCode: string | null = body.promo_code ? String(body.promo_code) : null;

  // ── quote ──
  if (body.action === 'quote') {
    const quote = quoteBooking(rooms, pricingOptions, pricingAddons, selectedAddons, pricingCfg, promoCode);
    return json({ quote, invalid_promo: !!promoCode && !quote.promo });
  }

  // ── book ──
  if (body.action !== 'book') return json({ error: 'unknown action' }, 400);

  const ip = getClientIP(req);
  const rl = checkRateLimit(`group-booking:${ip}`, 5, 60);
  if (rl) return rateLimitResponse(rl.retryAfter, corsHeaders);

  const contact = body.contact ?? {};
  const first_name = String(contact.first_name ?? '').trim();
  const last_name = String(contact.last_name ?? '').trim();
  const email = String(contact.email ?? '').trim().toLowerCase();
  const phone = String(contact.phone ?? '').trim();
  if (!first_name || !email || !emailOk(email)) return json({ error: 'Lead guest first name and a valid email are required.' }, 400);
  if (!body.terms_accepted) return json({ error: 'Please accept the booking terms.' }, 400);

  const roomErr = validateRooms(rooms, pricingOptions);
  if (roomErr) return json({ error: roomErr }, 400);

  // every guest needs a first + last name and a birthdate
  for (let i = 0; i < rooms.length; i++) {
    const r: any = rooms[i];
    const need = r.adults + r.children;
    const guests = (r.guests ?? []).slice(0, need);
    if (guests.length < need) return json({ error: `Room ${i + 1}: enter every guest's details.` }, 400);
    for (const g of guests) {
      if (!String(g.first_name ?? '').trim() || !String(g.last_name ?? '').trim() || !g.birthdate)
        return json({ error: `Room ${i + 1}: each guest needs first name, last name and date of birth.` }, 400);
    }
  }

  const quote = quoteBooking(rooms, pricingOptions, pricingAddons, selectedAddons, pricingCfg, promoCode);
  if (quote.total <= 0) return json({ error: 'Nothing to book.' }, 400);
  // Charge exactly what the guest was shown as due today — never fall back to the full total.
  const depositCents = Math.round(Number(quote.deposit_due || 0) * 100);
  if (depositCents < 50) return json({ error: 'No deposit is set up for this trip yet. Please contact your advisor to book.' }, 400);

  const supabase = admin();
  const currency = (trip.currency || 'usd').toLowerCase();

  // 1. client (find or create, same convention as group-signup)
  let clientId: string;
  const { data: existingClient } = await supabase.from('clients').select('id').eq('user_id', trip.user_id).eq('email', email).maybeSingle();
  if (existingClient) clientId = existingClient.id;
  else {
    const { data: c, error } = await supabase
      .from('clients')
      .insert({ user_id: trip.user_id, name: `${first_name} ${last_name}`.trim(), first_name, last_name: last_name || null, email, phone: phone || null, status: 'active', lead_source: 'group_booking' })
      .select('id')
      .single();
    if (error || !c) return json({ error: 'Could not create your client record.' }, 500);
    clientId = c.id;
  }

  // 2. sub-trip under the group trip
  const primaryOpt = cfg.cabinOptions.find((o: any) => o.id === rooms[0].cabin_option_id);
  const { data: subTrip, error: subErr } = await supabase
    .from('trips')
    .insert({
      user_id: trip.user_id,
      parent_trip_id: trip.id,
      trip_name: `${trip.trip_name} — ${first_name} ${last_name}`.trim(),
      destination: trip.destination,
      depart_date: trip.depart_date,
      return_date: trip.return_date,
      trip_type: 'regular',
      status: 'inbound',
      client_id: clientId,
      selected_cabin_option_id: rooms[0].cabin_option_id,
      cover_image_url: trip.cover_image_url,
      deposit_required: true,
      deposit_amount: quote.deposit_due,
      currency,
      notes: `Group booking: ${rooms.length} room(s), ${quote.guests} guest(s). ${primaryOpt ? primaryOpt.category_name : ''}`.trim(),
    })
    .select('id')
    .single();
  if (subErr || !subTrip) return json({ error: 'Could not create your trip record.' }, 500);

  // 3. booking on the sub-trip
  const { data: booking } = await supabase
    .from('bookings')
    .insert({
      user_id: trip.user_id,
      trip_id: subTrip.id,
      confirmation_number: `GRP-${subTrip.id.slice(0, 8).toUpperCase()}`,
      status: 'pending',
      gross_sales: quote.total,
      total_price: quote.total,
      net_sales: quote.total,
      commissionable_amount: quote.fare_subtotal,
      pricing_mode: 'commission',
      source: 'group_booking',
    })
    .select('id')
    .single();

  // 4. travelers
  const travelerRows: any[] = [];
  rooms.forEach((r: any, ri: number) => {
    (r.guests ?? []).slice(0, r.adults + r.children).forEach((g: any, gi: number) => {
      travelerRows.push({
        user_id: trip.user_id,
        trip_id: subTrip.id,
        first_name: String(g.first_name).trim(),
        last_name: String(g.last_name).trim(),
        birthday: g.birthdate,
        email: g.email ? String(g.email).trim().toLowerCase() : ri === 0 && gi === 0 ? email : null,
        phone: g.phone ? String(g.phone).trim() : ri === 0 && gi === 0 ? phone || null : null,
        is_primary: ri === 0 && gi === 0,
        linked_client_id: ri === 0 && gi === 0 ? clientId : null,
        notes: `Room ${ri + 1}${gi >= r.adults ? ' (child)' : ''}`,
      });
    });
  });
  if (travelerRows.length) await supabase.from('trip_travelers').insert(travelerRows);

  // 5. legacy group_signups row so existing dashboards/counts keep working
  const { data: signup } = await supabase
    .from('group_signups')
    .insert({ trip_id: trip.id, sub_trip_id: subTrip.id, first_name, last_name: last_name || null, email, phone: phone || null, number_of_travelers: quote.guests, status: 'pending_deposit', notes: `Wizard booking, ${rooms.length} room(s)` })
    .select('id')
    .single();

  // 6. group_bookings (pricing snapshot + guests)
  const { data: gb, error: gbErr } = await supabase
    .from('group_bookings')
    .insert({
      trip_id: trip.id,
      user_id: trip.user_id,
      status: 'pending_payment',
      contact_first_name: first_name,
      contact_last_name: last_name || null,
      contact_email: email,
      contact_phone: phone || null,
      rooms,
      addons: selectedAddons,
      promo_code: quote.promo ? quote.promo.code : null,
      pricing: quote,
      currency,
      total_cents: Math.round(quote.total * 100),
      deposit_cents: depositCents,
      client_id: clientId,
      sub_trip_id: subTrip.id,
      booking_id: booking?.id ?? null,
      group_signup_id: signup?.id ?? null,
      terms_accepted_at: new Date().toISOString(),
      ip_address: ip,
    })
    .select('id')
    .single();
  if (gbErr || !gb) return json({ error: 'Could not save your booking.' }, 500);

  // 7. Stripe PaymentIntent for the deposit (same raw-fetch convention as create-payment-intent)
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY_CLIENT');
  if (!STRIPE_SECRET_KEY) return json({ error: 'Payments are not configured.' }, 500);

  const params = new URLSearchParams({
    amount: String(depositCents),
    currency,
    'automatic_payment_methods[enabled]': 'true',
    'automatic_payment_methods[allow_redirects]': 'never',
    receipt_email: email,
    description: `Crestwell Travel – ${trip.trip_name} deposit (Ref: GRP-${subTrip.id.slice(0, 8).toUpperCase()})`,
  });
  const metadata: Record<string, string> = {
    payment_type: 'group_deposit',
    group_booking_id: gb.id,
    trip_id: subTrip.id,
    parent_trip_id: trip.id,
    booking_id: booking?.id ?? '',
    agent_user_id: trip.user_id,
    customer_name: `${first_name} ${last_name}`.trim(),
    customer_email: email,
    booking_ref: `GRP-${subTrip.id.slice(0, 8).toUpperCase()}`,
    trip_name: trip.trip_name,
  };
  for (const [k, v] of Object.entries(metadata)) if (v) params.append(`metadata[${k}]`, v);

  const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const pi = await piRes.json();
  if (pi.error) {
    await supabase.from('group_bookings').update({ status: 'payment_failed' }).eq('id', gb.id);
    return json({ error: `Payment setup failed: ${pi.error.message}` }, 502);
  }

  const { data: cp } = await supabase
    .from('checkout_payments')
    .insert({
      customer_name: `${first_name} ${last_name}`.trim(),
      customer_email: email,
      customer_phone: phone || null,
      amount_cents: depositCents,
      currency,
      payment_method: 'stripe',
      payment_type: 'group_deposit',
      booking_ref: metadata.booking_ref,
      trip_name: trip.trip_name,
      status: 'pending',
      stripe_payment_intent_id: pi.id,
      trip_id: subTrip.id,
      agent_user_id: trip.user_id,
      booking_id: booking?.id ?? null,
      metadata: { group_booking_id: gb.id },
    })
    .select('id')
    .single();

  await supabase
    .from('group_bookings')
    .update({ stripe_payment_intent_id: pi.id, checkout_payment_id: cp?.id ?? null })
    .eq('id', gb.id);

  await supabase.from('agent_notifications').insert({
    user_id: trip.user_id,
    type: 'group_booking',
    title: `New group booking: ${first_name} ${last_name}`.trim(),
    message: `${rooms.length} room(s), ${quote.guests} guest(s), deposit ${(depositCents / 100).toFixed(2)} ${currency.toUpperCase()} pending on ${trip.trip_name}`,
    trip_id: trip.id,
  });

  // This records a signup with payment pending, never a paid-deposit receipt.
  try {
    const brand = await resolveAgentBranding(supabase, trip.user_id);
    const name = `${first_name} ${last_name}`.trim();
    const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(depositCents / 100);
    const reservationUrl = `https://app.crestwelltravels.com/group/${encodeURIComponent(token)}/reservation/${subTrip.id}`;
    const details = `<p>${escapeHtml(trip.trip_name)} — ${rooms.length} room(s), ${quote.guests} guest(s).</p><p>Deposit requested: ${amount}. Payment is pending; this email is not a receipt or a confirmed supplier reservation.</p>`;
    await sendGroupEventEmails({
      admin: supabase, brand, userId: trip.user_id, eventId: gb.id, template: 'group_booking_signup', clientId,
      clientEmail: email, clientSubject: `Your signup for ${trip.trip_name}`,
      clientHtml: `<p>Hello ${escapeHtml(name)},</p>${details}<p><a href="${reservationUrl}">View your reservation</a></p><p>${escapeHtml(brand.agencyName)}</p>`,
      advisorSubject: `New group booking signup: ${name}`,
      advisorHtml: `<p>${escapeHtml(name)} submitted a group booking.</p><p>Email: ${escapeHtml(email)}</p>${details}<p><a href="https://app.crestwelltravels.com/trips/${subTrip.id}">Review traveler trip</a></p>`,
      metadata: { source: 'group-booking', trip_id: trip.id, sub_trip_id: subTrip.id, group_booking_id: gb.id },
    });
  } catch (error) {
    console.error('Group booking email failed:', error);
  }

  return json({
    ok: true,
    group_booking_id: gb.id,
    booking_ref: metadata.booking_ref,
    clientSecret: pi.client_secret,
    deposit_cents: depositCents,
    total_cents: Math.round(quote.total * 100),
    quote,
  });
});
