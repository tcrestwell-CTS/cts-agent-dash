// RateHawk booking flow: hotel page -> prebook -> booking form -> (guest deposit
// via existing Stripe client-account PaymentIntent) -> finish -> finish/status.
// RateHawk itself is paid from our ETG B2B account (payment_type "deposit").
// hotelpage/prebook responses are NEVER cached.
import { RATEHAWK_ENV, ratehawkPost, ratehawkPostRaw } from "../_shared/ratehawk-auth.ts";
import { classify, errorCode, type Stage } from "./errors.ts";

const FORM_MAX_ATTEMPTS = 10; // ETG: limit create-booking retries to 10

/** Never throws for upstream trouble: network errors / non-JSON / 5xx come back
 *  as { status:"error", error:"timeout"|..., httpStatus } so the caller can
 *  apply ETG's per-endpoint rules. */
async function rhCall(path: string, body: unknown): Promise<any> {
  try {
    return await ratehawkPostRaw(path, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.match(/^\[(\d{3})\]/);
    return { status: "error", error: "network", httpStatus: m ? Number(m[1]) : 599, transport_error: msg };
  }
}
function outcome(stage: Stage, resp: any) {
  const code = errorCode(resp?.error);
  return classify(stage, code, resp?.httpStatus);
}
function errFields(stage: Stage, c: { code: string; retryable: boolean; message: string }) {
  return { rh_error_code: c.code, error_stage: stage, error_retryable: c.retryable, advisor_message: c.message };
}

type Admin = any;

const POLL_INTERVAL_MS = 1000;
const POLL_MAX_MS = 60_000;

const bad = (m: string) => new Error(`[400] ${m}`);

function rateAmount(rate: any): number | null {
  const pt = rate?.payment_options?.payment_types?.[0];
  const n = parseFloat(pt?.show_amount ?? pt?.amount ?? "");
  return Number.isFinite(n) ? n : null;
}
function rateCancellation(rate: any) {
  const pt = rate?.payment_options?.payment_types?.[0];
  return pt?.cancellation_penalties ?? null;
}
function normGuests(guests: any): { adults: number; children: number[] }[] {
  if (!Array.isArray(guests) || !guests.length) throw bad("guests (one entry per room) is required");
  return guests.map((g: any, i: number) => {
    const adults = Number(g?.adults);
    if (!Number.isInteger(adults) || adults < 1 || adults > 6) throw bad(`room ${i + 1}: adults must be 1-6`);
    const children = (Array.isArray(g?.children) ? g.children : []).map(Number);
    for (const a of children) {
      if (!Number.isInteger(a) || a < 0 || a > 17) throw bad(`room ${i + 1}: child ages must be integers 0-17 (0 = infant)`);
    }
    return { adults, children };
  });
}
async function loadOrder(admin: Admin, orderId: string, userId: string, isAdmin: boolean) {
  if (!orderId) throw bad("order_id is required");
  const { data, error } = await admin.from("ratehawk_orders").select("*").eq("id", orderId).maybeSingle();
  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  if (!data || (data.user_id !== userId && !isAdmin)) throw new Error("[404] Order not found");
  return data;
}
async function patch(admin: Admin, id: string, fields: Record<string, unknown>) {
  const { data, error } = await admin.from("ratehawk_orders").update(fields).eq("id", id).select("*").single();
  if (error) throw new Error(`Order update failed: ${error.message}`);
  return data;
}

/** Verify the guest deposit via the existing Stripe client-account integration. */
async function verifyStripeDeposit(piId: string, minCents: number) {
  const key = Deno.env.get("STRIPE_SECRET_KEY_CLIENT");
  if (!key) throw new Error("Stripe client key not configured");
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(piId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const pi = await res.json();
  if (!res.ok) throw bad(`Stripe payment ${piId} not found: ${pi?.error?.message ?? res.status}`);
  if (pi.status !== "succeeded") throw bad(`Guest deposit not captured (Stripe status: ${pi.status})`);
  if (Number(pi.amount_received) < minCents) {
    throw bad(`Guest deposit ${pi.amount_received / 100} is below required ${minCents / 100}`);
  }
  return pi;
}

async function pollFinishStatus(admin: Admin, order: any) {
  const started = Date.now();
  // ETG: poll ~every 1s, with a final check right at the timeout boundary.
  const handle = async (last: any) => {
    if (last.status === "ok" && !last.error) {
      return await patch(admin, order.id, {
        status: "booked", booked_at: new Date().toISOString(), last_status_payload: last, last_error: null,
        rh_error_code: null, error_stage: null, error_retryable: null, advisor_message: "Booking confirmed by RateHawk.",
      });
    }
    if (last.status === "error" || last.error) {
      const c = outcome("status", last);
      if (c.kind !== "continue") {
        // Guest deposit already captured -> a human must refund or rebook.
        return await patch(admin, order.id, {
          status: "needs_attention",
          last_error: `booking/finish/status: ${c.code}`,
          last_status_payload: last,
          ...errFields("status", c),
          advisor_message: `${c.message} The guest deposit (${order.stripe_payment_intent_id}) was captured and must be refunded or used for a new booking.`,
        });
      }
    }
    return null;
  };
  const check = () => rhCall("/api/b2b/v3/hotel/order/booking/finish/status", {
    partner_order_id: order.partner_order_id,
  });

  let last: any = null;
  while (Date.now() - started < POLL_MAX_MS) {
    last = await check();
    const done = await handle(last);
    if (done) return done;
    // processing, 3ds (unsupported for deposit), timeout/unknown/5xx -> keep polling
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  // Final check exactly at the timeout boundary.
  const done = await handle(await check());
  if (done) return done;
  return await patch(admin, order.id, {
    status: "processing", last_status_payload: last,
    advisor_message: "RateHawk is still confirming this booking. Check status again in a minute — do not rebook or refund yet.",
    error_retryable: true,
  });
}

export async function handleBookingAction(
  action: string,
  p: any,
  ctx: { admin: Admin; userId: string; isAdmin: boolean; clientIp: string },
): Promise<any | undefined> {
  const { admin, userId, isAdmin } = ctx;
  switch (action) {
    case "hotel_page": {
      if (!p.checkin || !p.checkout) throw bad("checkin and checkout are required");
      if (p.hid == null && !p.id) throw bad("hid or id is required");
      const body: any = {
        checkin: p.checkin,
        checkout: p.checkout,
        residency: (p.residency || "us").toLowerCase(),
        language: p.language || "en",
        guests: normGuests(p.guests),
        currency: p.currency || "USD",
      };
      if (p.hid != null) body.hid = Number(p.hid); else body.id = String(p.id);
      const resp = await ratehawkPost("/api/b2b/v3/search/hp", body);
      const hotel = resp?.data?.hotels?.[0] ?? null;
      return {
        hotel_id: hotel?.id ?? null,
        hid: hotel?.hid ?? body.hid ?? null,
        rates: (hotel?.rates ?? []).map((r: any) => ({
          book_hash: r.book_hash,
          match_hash: r.match_hash,
          room_name: r.room_name,
          meal: r.meal,
          amount: rateAmount(r),
          currency: r?.payment_options?.payment_types?.[0]?.show_currency_code ?? body.currency,
          cancellation_penalties: rateCancellation(r),
          raw: r,
        })),
      };
    }

    case "prebook": {
      // Requires the rate the guest actually saw so we can compare.
      const hash = p.book_hash || p.hash;
      if (!hash) throw bad("book_hash (from hotel_page) is required");
      const expected = Number(p.expected_amount);
      if (!Number.isFinite(expected) || expected <= 0) throw bad("expected_amount (price shown to guest) is required");
      if (!p.checkin || !p.checkout) throw bad("checkin and checkout are required");
      const guests = normGuests(p.guests);
      const resp = await ratehawkPost("/api/b2b/v3/hotel/prebook", {
        hash,
        language: p.language || "en",
        price_increase_percent: Number.isFinite(Number(p.price_increase_percent)) ? Number(p.price_increase_percent) : 10,
      });
      const rate = resp?.data?.hotels?.[0]?.rates?.[0];
      if (!rate?.book_hash) throw new Error("[502] RateHawk prebook returned no bookable rate");
      const newAmount = rateAmount(rate);
      if (newAmount == null) throw new Error("[502] RateHawk prebook returned no price");
      const diff = Math.round((newAmount - expected) * 100) / 100;
      const pct = Math.round((diff / expected) * 100000) / 1000;
      const priceChanged = Math.abs(diff) >= 0.01 || resp?.data?.changes?.price_changed === true;
      const prebookCancel = rateCancellation(rate);
      const searchCancel = p.expected_cancellation_penalties ?? null;
      const policyChanged = searchCancel != null && JSON.stringify(searchCancel) !== JSON.stringify(prebookCancel);

      const partnerOrderId = `CTS-RH-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const { data: order, error } = await admin.from("ratehawk_orders").insert({
        user_id: userId,
        trip_id: p.trip_id || null,
        environment: RATEHAWK_ENV,
        partner_order_id: partnerOrderId,
        hid: p.hid != null ? Number(p.hid) : null,
        hotel_id: p.hotel_id || null,
        hotel_name: p.hotel_name || null,
        room_name: rate.room_name || p.room_name || null,
        checkin: p.checkin,
        checkout: p.checkout,
        residency: (p.residency || "us").toLowerCase(),
        currency: p.currency || "USD",
        search_guests: guests,
        source_hash: hash,
        book_hash: rate.book_hash,
        search_amount: expected,
        prebook_amount: newAmount,
        price_changed: priceChanged,
        price_change_pct: pct,
        policy_changed: policyChanged,
        search_cancellation: searchCancel,
        prebook_cancellation: prebookCancel,
        status: priceChanged || policyChanged ? "price_change_pending" : "prebooked",
        raw_prebook: resp?.data ?? null,
      }).select("*").single();
      if (error) throw new Error(`Order create failed: ${error.message}`);
      return {
        order_id: order.id,
        partner_order_id: partnerOrderId,
        status: order.status,
        requires_confirmation: priceChanged || policyChanged,
        price: { shown: expected, current: newAmount, difference: diff, difference_pct: pct, changed: priceChanged },
        cancellation: { changed: policyChanged, before: searchCancel, after: prebookCancel },
      };
    }

    case "create_booking_form": {
      let order = await loadOrder(admin, p.order_id, userId, isAdmin);
      if (order.status === "price_change_pending") {
        if (p.accept_price_change !== true) {
          throw bad(`Price or cancellation terms changed at prebook (shown ${order.search_amount}, now ${order.prebook_amount}). Re-confirm with the guest and resend with accept_price_change: true.`);
        }
        order = await patch(admin, order.id, { price_change_accepted: true, status: "prebooked" });
      }
      if (order.status !== "prebooked") throw bad(`Order is ${order.status}; booking form already created or not allowed`);
      // ETG rule: on timeout/unknown/5xx/double_booking_form/duplicate_reservation,
      // retry with a NEW partner_order_id (max 10). No money has moved at this step,
      // and the orphan form upstream simply expires, so this is safe.
      let resp: any = null;
      let attempts = order.form_attempts ?? 0;
      const prevIds: string[] = [...(order.previous_partner_order_ids ?? [])];
      while (true) {
        attempts++;
        resp = await rhCall("/api/b2b/v3/hotel/order/booking/form", {
          partner_order_id: order.partner_order_id,
          book_hash: order.book_hash,
          language: p.language || "en",
          user_ip: ctx.clientIp && ctx.clientIp !== "unknown" ? ctx.clientIp : "34.237.67.148",
        });
        if (resp.status === "ok" && !resp.error) break;
        const c = outcome("form", resp);
        if (c.kind === "retry_new_id" && attempts < FORM_MAX_ATTEMPTS) {
          prevIds.push(order.partner_order_id);
          order = await patch(admin, order.id, {
            partner_order_id: `CTS-RH-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
            previous_partner_order_ids: prevIds, form_attempts: attempts,
            last_error: `booking/form ${c.code} (auto-retrying)`,
          });
          continue;
        }
        const tooMany = c.kind === "retry_new_id";
        await patch(admin, order.id, {
          status: c.kind === "rebook" ? "rebook_required" : "failed",
          form_attempts: attempts, raw_form: resp,
          last_error: `booking/form: ${c.code}`,
          ...errFields("form", c),
          ...(tooMany ? { error_retryable: false, advisor_message: "RateHawk failed to create the booking form 10 times in a row. Contact the RateHawk account manager (likely a contract setting)." } : {}),
        });
        throw bad(tooMany ? `RateHawk booking form failed ${attempts} times (${c.code})` : `${c.code}: ${c.message}`);
      }
      order = await patch(admin, order.id, { form_attempts: attempts });
      const d = resp?.data ?? {};
      const payTypes: any[] = d.payment_types ?? [];
      const b2b = payTypes.find((t) => t.type === "deposit");
      if (!b2b) {
        await patch(admin, order.id, { status: "failed", last_error: "Rate not payable from B2B deposit account", raw_form: d });
        throw new Error(`[502] Rate cannot be paid via ETG B2B deposit (offered: ${payTypes.map((t) => t.type).join(", ") || "none"})`);
      }
      order = await patch(admin, order.id, {
        status: "form_created",
        rh_order_id: d.order_id ?? null,
        rh_item_id: d.item_id ?? null,
        rh_payment_type: b2b,
        raw_form: d,
      });
      return {
        order_id: order.id,
        status: order.status,
        rh_order_id: order.rh_order_id,
        supplier_amount: b2b.amount,
        supplier_currency: b2b.currency_code,
        is_gender_specification_required: d.is_gender_specification_required ?? false,
        upsell_data: d.upsell_data ?? null,
      };
    }

    case "finish_booking": {
      let order = await loadOrder(admin, p.order_id, userId, isAdmin);
      if (order.status !== "form_created") throw bad(`Order is ${order.status}; cannot finish`);
      const searchGuests = order.search_guests as { adults: number; children: number[] }[];
      const rooms = p.rooms;
      if (!Array.isArray(rooms) || rooms.length !== searchGuests.length) {
        throw bad(`rooms must have exactly ${searchGuests.length} entries (one per searched room)`);
      }
      const rhRooms = rooms.map((room: any, i: number) => {
        const gs = Array.isArray(room?.guests) ? room.guests : [];
        const adults = gs.filter((g: any) => !g.is_child);
        const kids = gs.filter((g: any) => g.is_child);
        if (adults.length !== searchGuests[i].adults) throw bad(`room ${i + 1}: expected ${searchGuests[i].adults} adult name(s), got ${adults.length}`);
        const wantAges = [...searchGuests[i].children].sort((a, b) => a - b);
        const gotAges = kids.map((k: any) => Number(k.age)).sort((a: number, b: number) => a - b);
        if (JSON.stringify(wantAges) !== JSON.stringify(gotAges)) throw bad(`room ${i + 1}: child ages ${JSON.stringify(gotAges)} must match searched ages ${JSON.stringify(wantAges)}`);
        return {
          guests: gs.map((g: any) => {
            if (!g.first_name?.trim() || !g.last_name?.trim()) throw bad(`room ${i + 1}: every guest needs first_name and last_name`);
            const out: any = { first_name: g.first_name.trim(), last_name: g.last_name.trim() };
            if (g.is_child) { out.is_child = true; out.age = Number(g.age); }
            if (g.gender) out.gender = g.gender;
            return out;
          }),
        };
      });
      const email = p.contact?.email?.trim();
      const phone = p.contact?.phone?.trim();
      if (!email || !phone) throw bad("contact.email and contact.phone are required");

      // 1) Guest deposit MUST be captured before finish.
      let paymentRef: string;
      if (order.payment_status === "captured" && order.stripe_payment_intent_id) {
        paymentRef = order.stripe_payment_intent_id; // resubmission after a fix_input error
      } else if (p.sandbox_payment_bypass === true) {
        if (RATEHAWK_ENV !== "sandbox" || !isAdmin) throw bad("sandbox_payment_bypass is only allowed for admins in sandbox");
        paymentRef = `sandbox-bypass-${order.partner_order_id}`;
      } else {
        const deposit = Number(p.guest_deposit_amount);
        if (!p.stripe_payment_intent_id || !Number.isFinite(deposit) || deposit <= 0) {
          throw bad("stripe_payment_intent_id and guest_deposit_amount are required");
        }
        const { data: reused } = await admin.from("ratehawk_orders").select("id")
          .eq("stripe_payment_intent_id", p.stripe_payment_intent_id).neq("id", order.id).maybeSingle();
        if (reused) throw bad("This payment is already attached to another hotel order");
        await verifyStripeDeposit(p.stripe_payment_intent_id, Math.round(deposit * 100));
        paymentRef = p.stripe_payment_intent_id;
      }
      order = await patch(admin, order.id, {
        stripe_payment_intent_id: paymentRef,
        guest_deposit_amount: order.payment_status === "captured" ? order.guest_deposit_amount : (p.sandbox_payment_bypass ? 0 : Number(p.guest_deposit_amount)),
        payment_status: "captured",
        status: "finishing",
        rooms: rhRooms,
        contact: { email, phone },
        finish_attempts: (order.finish_attempts ?? 0) + 1,
      });

      // 2) finish (async on RateHawk's side)
      const pt = order.rh_payment_type;
      const lead = rhRooms[0].guests[0];
      const fin = await rhCall("/api/b2b/v3/hotel/order/booking/finish", {
        user: { email, phone, comment: p.comment || undefined },
        supplier_data: { first_name_original: lead.first_name, last_name_original: lead.last_name, phone, email },
        partner: { partner_order_id: order.partner_order_id },
        language: p.language || "en",
        rooms: rhRooms,
        payment_type: { type: "deposit", amount: pt.amount, currency_code: pt.currency_code },
      });
      if (fin.status !== "ok" || fin.error) {
        const c = outcome("finish", fin);
        // ETG: timeout/unknown/5xx and double_booking_finish mean "go check status",
        // not "failed" — the booking may well be in progress upstream.
        if (c.kind !== "continue") {
          order = await patch(admin, order.id, {
            status: c.kind === "fix_input" ? "form_created" : "needs_attention",
            last_error: `booking/finish: ${c.code}`,
            ...errFields("finish", c),
            advisor_message: c.kind === "fix_input"
              ? `${c.message} The guest deposit is held on this order; resubmit with corrected details.`
              : `${c.message} The guest deposit (${paymentRef}) was captured and must be refunded or used for a new booking.`,
          });
          return summarize(order);
        }
        order = await patch(admin, order.id, { last_error: `booking/finish: ${c.code} (checking status)` });
      }

      // 3) poll until final
      order = await pollFinishStatus(admin, order);
      return summarize(order);
    }

    case "booking_status": {
      let order = await loadOrder(admin, p.order_id, userId, isAdmin);
      if (["finishing", "processing"].includes(order.status)) order = await pollFinishStatus(admin, order);
      return summarize(order);
    }

    case "list_orders": {
      let q = admin.from("ratehawk_orders").select("id, partner_order_id, rh_order_id, hotel_name, checkin, checkout, status, prebook_amount, currency, payment_status, stripe_payment_intent_id, last_error, rh_error_code, advisor_message, created_at").order("created_at", { ascending: false }).limit(25);
      if (!isAdmin) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { orders: data ?? [] };
    }
  }
  return undefined;
}

function summarize(o: any) {
  return {
    order_id: o.id,
    partner_order_id: o.partner_order_id,
    rh_order_id: o.rh_order_id,
    status: o.status,
    hotel_name: o.hotel_name,
    room_name: o.room_name,
    amount: o.prebook_amount,
    currency: o.currency,
    payment_reference: o.stripe_payment_intent_id,
    error: o.last_error,
    error_code: o.rh_error_code ?? null,
    error_stage: o.error_stage ?? null,
    retryable: o.error_retryable ?? null,
    advisor_message: o.advisor_message ?? null,
    action_required: o.status === "needs_attention" ? "refund_or_rebook"
      : o.status === "processing" ? "poll_booking_status"
      : o.status === "form_created" && o.error_stage === "finish" ? "correct_and_resubmit"
      : o.status === "rebook_required" ? "search_again" : null,
  };
}
