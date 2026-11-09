// Group booking pricing — shared between the public wizard (display) and the
// group-booking edge function (authoritative). Keep this file byte-identical to
// supabase/functions/_shared/group-pricing.ts.

export type CabinOptionPricing = {
  id: string;
  category_group: string;
  category_name: string;
  price_per_person: number;
  price_period?: string | null;
  third_fourth_price: number | null;
  child_price: number | null;
  single_supplement_pct: number;
  deposit_amount: number | null;
  sleeps_min: number;
  sleeps_max: number;
  sold_out: boolean;
};

export type AddonPricing = {
  id: string;
  name: string;
  price: number;
  price_basis: "per_person" | "per_room" | "per_booking";
};

export type PromoCode = {
  code: string;
  label?: string;
  percent_off?: number;
  amount_off_per_person?: number;
};

export type RoomInput = {
  cabin_option_id: string | null;
  adults: number;
  children: number;
  accessible?: boolean;
};

export type TripPricingConfig = {
  taxes_fees_per_person: number;
  group_deposit_per_person: number | null;
  promo_codes: PromoCode[];
};

export type RoomQuote = {
  cabin_option_id: string | null;
  guests: number;
  fare: number;
  taxes: number;
  per_person_display: number; // "starting from" per person at double occupancy
  breakdown: { seat: number; label: string; amount: number }[];
  deposit: number;
};

export type Quote = {
  rooms: RoomQuote[];
  fare_subtotal: number;
  taxes_total: number;
  addons_total: number;
  discount: number;
  total: number;
  deposit_due: number;
  guests: number;
  promo?: PromoCode | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function seatPrice(opt: CabinOptionPricing, seat: number, isChild: boolean, guestsInRoom: number): number {
  const base = Number(opt.price_per_person) || 0;
  if (guestsInRoom === 1) return r2(base * (1 + (Number(opt.single_supplement_pct) || 0) / 100));
  const thirdFourth = opt.third_fourth_price != null ? Number(opt.third_fourth_price) : base;
  if (isChild && opt.child_price != null) return Number(opt.child_price);
  return seat <= 2 ? base : thirdFourth;
}

export function quoteRoom(opt: CabinOptionPricing | null, room: RoomInput, cfg: TripPricingConfig): RoomQuote {
  const guests = Math.max(0, (room.adults || 0) + (room.children || 0));
  if (!opt || guests === 0) {
    return { cabin_option_id: room.cabin_option_id, guests, fare: 0, taxes: 0, per_person_display: opt ? Number(opt.price_per_person) : 0, breakdown: [], deposit: 0 };
  }
  if (opt.price_period === "cabin") {
    const fare = r2(Number(opt.price_per_person) || 0);
    const taxes = r2((Number(cfg.taxes_fees_per_person) || 0) * guests);
    const depositPP = Number(opt.deposit_amount) > 0 ? Number(opt.deposit_amount) : Number(cfg.group_deposit_per_person) || 0;
    return { cabin_option_id: opt.id, guests, fare, taxes, per_person_display: r2(fare / guests),
      breakdown: [{ seat: 1, label: "Cabin total", amount: fare }], deposit: r2(Math.min(depositPP * guests, fare + taxes)) };
  }
  const breakdown: RoomQuote["breakdown"] = [];
  let seat = 0;
  for (let i = 0; i < room.adults; i++) {
    seat++;
    breakdown.push({ seat, label: `Adult ${i + 1}`, amount: seatPrice(opt, seat, false, guests) });
  }
  for (let i = 0; i < room.children; i++) {
    seat++;
    breakdown.push({ seat, label: `Child ${i + 1}`, amount: seatPrice(opt, seat, true, guests) });
  }
  const fare = r2(breakdown.reduce((s, b) => s + b.amount, 0));
  const taxes = r2((Number(cfg.taxes_fees_per_person) || 0) * guests);
  // A room deposit of 0/blank means "not set" and falls back to the group deposit.
  const depositPP = Number(opt.deposit_amount) > 0 ? Number(opt.deposit_amount) : Number(cfg.group_deposit_per_person) || 0;
  const deposit = r2(Math.min(depositPP * guests, fare + taxes));
  return { cabin_option_id: opt.id, guests, fare, taxes, per_person_display: Number(opt.price_per_person), breakdown, deposit };
}

export function quoteBooking(
  rooms: RoomInput[],
  options: CabinOptionPricing[],
  addons: AddonPricing[],
  selectedAddons: { addon_id: string; quantity: number }[],
  cfg: TripPricingConfig,
  promoCode?: string | null,
): Quote {
  const byId = new Map(options.map((o) => [o.id, o]));
  const roomQuotes = rooms.map((r) => quoteRoom(r.cabin_option_id ? byId.get(r.cabin_option_id) ?? null : null, r, cfg));
  const guests = roomQuotes.reduce((s, q) => s + q.guests, 0);
  const fare_subtotal = r2(roomQuotes.reduce((s, q) => s + q.fare, 0));
  const taxes_total = r2(roomQuotes.reduce((s, q) => s + q.taxes, 0));

  const addonById = new Map(addons.map((a) => [a.id, a]));
  let addons_total = 0;
  for (const sel of selectedAddons) {
    const a = addonById.get(sel.addon_id);
    if (!a || sel.quantity <= 0) continue;
    const price = Number(a.price) || 0;
    if (a.price_basis === "per_person") addons_total += price * guests;
    else if (a.price_basis === "per_room") addons_total += price * rooms.filter((r) => (r.adults + r.children) > 0).length;
    else addons_total += price * sel.quantity;
  }
  addons_total = r2(addons_total);

  let discount = 0;
  let promo: PromoCode | null = null;
  if (promoCode) {
    promo = (cfg.promo_codes || []).find((p) => p.code.trim().toLowerCase() === promoCode.trim().toLowerCase()) ?? null;
    if (promo) {
      if (promo.percent_off) discount += fare_subtotal * (Number(promo.percent_off) / 100);
      if (promo.amount_off_per_person) discount += Number(promo.amount_off_per_person) * guests;
      discount = r2(Math.min(discount, fare_subtotal));
    }
  }

  const total = r2(fare_subtotal + taxes_total + addons_total - discount);
  const deposit_due = r2(Math.min(roomQuotes.reduce((s, q) => s + q.deposit, 0), total));
  return { rooms: roomQuotes, fare_subtotal, taxes_total, addons_total, discount, total, deposit_due, guests, promo };
}

export function money(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n || 0);
}
