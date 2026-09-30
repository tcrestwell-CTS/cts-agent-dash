/**
 * Public group booking wizard — /group/:token/book
 *
 * Six steps in the cruise-line convention (Party Size → Room Selection → Add-ons →
 * Review → Guest Info → Pay) with a sticky trip/price summary rail. All pricing shown
 * is computed locally with src/lib/groupPricing.ts; the group-booking edge function
 * recomputes it before charging, and the Stripe deposit is collected with Payment Element.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Minus, Plus, Check, ChevronLeft, ChevronRight, Accessibility, Loader2, Info, Tag, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { parseLocalDate } from "@/lib/utils";
import { money, quoteBooking, type CabinOptionPricing, type Quote, type RoomInput } from "@/lib/groupPricing";

// ─── Types ──────────────────────────────────────────────────────────────────
type CabinOption = CabinOptionPricing & {
  description: string | null;
  image_url: string | null;
  images: string[];
  features: string[];
  sqft: string | null;
  capacity: number | null;
  remaining: number | null;
  accessible_available: boolean;
  badge: string | null;
  sort_order: number;
};
type Addon = { id: string; name: string; description: string | null; price: number; price_basis: "per_person" | "per_room" | "per_booking"; image_url: string | null };
type Guest = { first_name: string; last_name: string; birthdate: string; email: string; phone: string };
type Room = RoomInput & { guests: Guest[] };
type Config = {
  trip: {
    id: string; trip_name: string; destination: string | null; depart_date: string | null; return_date: string | null;
    cover_image_url: string | null; group_landing_headline: string | null; ship_name: string | null; ship_name_display: string | null;
    depart_port: string | null; ports_of_call: string[]; taxes_fees_per_person: number; group_deposit_per_person: number | null;
    final_payment_due: string | null; group_included_items: string[]; group_terms: string | null; max_rooms_per_booking: number;
    promo_codes: any[]; currency: string | null;
  };
  cabinOptions: CabinOption[];
  addons: Addon[];
  branding: { agency_name: string | null; logo_url: string | null; primary_color: string | null; accent_color: string | null; phone: string | null; email_address: string | null } | null;
  advisor: { full_name: string | null; phone: string | null } | null;
  stripe_publishable_key: string | null;
};

const STEPS = ["Party Size", "Room Selection", "Add-ons", "Review", "Guest Info", "Pay"] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 6 = confirmation

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/group-booking`;
const API_HEADERS = { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string };

const emptyGuest = (): Guest => ({ first_name: "", last_name: "", birthdate: "", email: "", phone: "" });
const emptyRoom = (): Room => ({ cabin_option_id: null, adults: 2, children: 0, accessible: false, guests: [] });

function fmtDate(d: string | null) {
  if (!d) return "";
  try { return format(parseLocalDate(d), "MMM d, yyyy"); } catch { return d; }
}

// ─── Small pieces ───────────────────────────────────────────────────────────
function Stepper({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div className="inline-flex items-center rounded-md border bg-muted/40">
      <button type="button" className="h-10 w-10 grid place-items-center disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="decrease"><Minus className="h-4 w-4" /></button>
      <span className="w-8 text-center text-lg font-semibold tabular-nums">{value}</span>
      <button type="button" className="h-10 w-10 grid place-items-center disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="increase"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

function ProgressBar({ step, onJump }: { step: StepIndex; onJump: (s: StepIndex) => void }) {
  return (
    <ol className="grid grid-cols-6 gap-2">
      {STEPS.map((label, i) => {
        const done = i < step, active = i === step;
        return (
          <li key={label}>
            <button type="button" disabled={!done} onClick={() => onJump(i as StepIndex)} className="w-full text-left disabled:cursor-default">
              <div className={`h-1 rounded-full mb-2 ${active ? "bg-primary" : done ? "bg-primary/60" : "bg-muted"}`} />
              <span className={`text-[11px] sm:text-xs flex items-center gap-1 ${active ? "font-semibold text-foreground" : done ? "text-primary underline-offset-2 hover:underline" : "text-muted-foreground"}`}>
                {done && <Check className="h-3 w-3" />}{label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Payment step ───────────────────────────────────────────────────────────
function PayForm({ depositCents, currency, onPaid }: { depositCents: number; currency: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    setBusy(false);
    if (error) { toast.error(error.message ?? "Payment failed"); return; }
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) onPaid();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <Button type="submit" size="lg" className="w-full" disabled={!stripe || busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
        Pay {money(depositCents / 100, currency)} deposit
      </Button>
      <p className="text-xs text-muted-foreground text-center">Secure payment by Stripe. The remaining balance is due later per the booking terms.</p>
    </form>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function GroupBooking() {
  const { token } = useParams<{ token: string }>();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<StepIndex>(0);
  const [rooms, setRooms] = useState<Room[]>([emptyRoom()]);
  const [roomIdx, setRoomIdx] = useState(0);             // which room is picking a stateroom
  const [group, setGroup] = useState<string | null>(null); // active category tab
  const [addonSel, setAddonSel] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);
  const [contact, setContact] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [terms, setTerms] = useState(false);
  const [booking, setBooking] = useState<{ clientSecret: string; deposit_cents: number; booking_ref: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  // load config
  useEffect(() => {
    if (!token) return;
    fetch(`${FN_BASE}?token=${encodeURIComponent(token)}`, { headers: { apikey: API_HEADERS.apikey } })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Unable to load"); return r.json(); })
      .then((d: Config) => {
        setCfg(d);
        const firstGroup = d.cabinOptions[0]?.category_group ?? null;
        setGroup(firstGroup);
        const pk = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) || d.stripe_publishable_key;
        if (pk) setStripePromise(loadStripe(pk));
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  const currency = (cfg?.trip.currency || "USD").toUpperCase();
  const optById = useMemo(() => new Map((cfg?.cabinOptions ?? []).map((o) => [o.id, o])), [cfg]);
  const groups = useMemo(() => {
    const m = new Map<string, CabinOption[]>();
    for (const o of cfg?.cabinOptions ?? []) m.set(o.category_group, [...(m.get(o.category_group) ?? []), o]);
    return [...m.entries()];
  }, [cfg]);

  const quote: Quote | null = useMemo(() => {
    if (!cfg) return null;
    return quoteBooking(
      rooms,
      cfg.cabinOptions,
      cfg.addons,
      Object.entries(addonSel).map(([addon_id, quantity]) => ({ addon_id, quantity })),
      { taxes_fees_per_person: Number(cfg.trip.taxes_fees_per_person ?? 0), group_deposit_per_person: cfg.trip.group_deposit_per_person, promo_codes: cfg.trip.promo_codes ?? [] },
      promo || null,
    );
  }, [cfg, rooms, addonSel, promo]);

  // keep guest arrays sized to party
  const setRoom = (i: number, patch: Partial<Room>) =>
    setRooms((rs) => rs.map((r, k) => {
      if (k !== i) return r;
      const next = { ...r, ...patch };
      const need = next.adults + next.children;
      const guests = [...(next.guests ?? [])];
      while (guests.length < need) guests.push(emptyGuest());
      return { ...next, guests: guests.slice(0, need) };
    }));

  const guestsTotal = rooms.reduce((s, r) => s + r.adults + r.children, 0);
  const lowestPP = (opts: CabinOption[]) => Math.min(...opts.filter((o) => !o.sold_out).map((o) => Number(o.price_per_person)));

  // ── Step gates ──
  const canLeavePartySize = rooms.every((r) => r.adults >= 1);
  const canLeaveRooms = rooms.every((r) => r.cabin_option_id && optById.get(r.cabin_option_id) && !optById.get(r.cabin_option_id)!.sold_out);
  const guestsValid = rooms.every((r) => r.guests.slice(0, r.adults + r.children).every((g) => g.first_name.trim() && g.last_name.trim() && g.birthdate));
  const contactValid = contact.first_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email);

  const goRooms = () => { setRoomIdx(0); setStep(1); };

  const submitBooking = async () => {
    if (!cfg || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch(FN_BASE, {
        method: "POST",
        headers: API_HEADERS,
        body: JSON.stringify({
          action: "book", token, rooms,
          addons: Object.entries(addonSel).map(([addon_id, quantity]) => ({ addon_id, quantity })),
          promo_code: promo || null, contact, terms_accepted: terms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start your booking");
      setBooking({ clientSecret: data.clientSecret, deposit_cents: data.deposit_cents, booking_ref: data.booking_ref });
      setStep(5);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / error ──
  if (loadError) {
    return <div className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-xl font-semibold mb-2">This booking page is not available</h1><p className="text-muted-foreground">{loadError}</p></div></div>;
  }
  if (!cfg || !quote) {
    return <div className="min-h-screen p-6 max-w-5xl mx-auto space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  const { trip, branding } = cfg;
  const primary = branding?.primary_color || "#1a365d";
  const headline = trip.group_landing_headline || trip.trip_name;

  // ── Render ──
  return (
    <div className="min-h-screen bg-muted/30" style={{ ["--brand" as any]: primary }}>
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={`/group/${token}`} className="flex items-center gap-2">
            {branding?.logo_url ? <img src={branding.logo_url} alt="" className="h-8" /> : <span className="font-semibold">{branding?.agency_name ?? "Crestwell Travel Services"}</span>}
          </Link>
          <div className="text-sm text-muted-foreground hidden sm:block">
            {cfg.advisor?.full_name && <span>Your advisor: {cfg.advisor.full_name}</span>}
            {branding?.phone && <span className="ml-3">{branding.phone}</span>}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* ── Sidebar rail ── */}
        <aside className="space-y-5 lg:sticky lg:top-4 self-start bg-background rounded-lg border p-5">
          <div>
            <h2 className="text-lg font-bold leading-tight">{headline}</h2>
            <dl className="mt-3 text-sm space-y-1">
              {trip.depart_port && <div className="flex gap-2"><dt className="font-semibold w-24 shrink-0">Leaving from</dt><dd className="text-muted-foreground">{trip.depart_port}</dd></div>}
              {(trip.ship_name_display || trip.ship_name) && <div className="flex gap-2"><dt className="font-semibold w-24 shrink-0">Onboard</dt><dd className="text-muted-foreground">{trip.ship_name_display || trip.ship_name}</dd></div>}
              {trip.depart_date && <div className="flex gap-2"><dt className="font-semibold w-24 shrink-0">Dates</dt><dd className="text-muted-foreground">{fmtDate(trip.depart_date)}{trip.return_date ? ` › ${fmtDate(trip.return_date)}` : ""}</dd></div>}
              {trip.destination && !trip.depart_port && <div className="flex gap-2"><dt className="font-semibold w-24 shrink-0">Destination</dt><dd className="text-muted-foreground">{trip.destination}</dd></div>}
            </dl>
            {trip.ports_of_call?.length > 0 && (
              <Accordion type="single" collapsible className="mt-1">
                <AccordionItem value="ports" className="border-0"><AccordionTrigger className="py-2 text-sm font-semibold text-primary">View ports</AccordionTrigger>
                  <AccordionContent><ol className="text-sm text-muted-foreground list-decimal ml-4 space-y-0.5">{trip.ports_of_call.map((p, i) => <li key={i}>{p}</li>)}</ol></AccordionContent></AccordionItem>
              </Accordion>
            )}
          </div>

          {trip.group_included_items?.length > 0 && (
            <Accordion type="single" collapsible className="border-t pt-2">
              <AccordionItem value="inc" className="border-0"><AccordionTrigger className="py-2 font-semibold">Included in your trip</AccordionTrigger>
                <AccordionContent><ul className="text-sm text-muted-foreground space-y-1">{trip.group_included_items.map((s, i) => <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />{s}</li>)}</ul></AccordionContent></AccordionItem>
            </Accordion>
          )}

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Room Selection</h3>
            {rooms.map((r, i) => {
              const o = r.cabin_option_id ? optById.get(r.cabin_option_id) : null;
              return (
                <div key={i} className="text-sm flex justify-between py-1">
                  <span className="text-muted-foreground">Room {i + 1} · {r.adults} Adult{r.adults === 1 ? "" : "s"}{r.children ? `, ${r.children} Child${r.children === 1 ? "" : "ren"}` : ""}</span>
                  <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => step > 1 ? (setRoomIdx(i), setStep(1)) : undefined}>{o ? o.category_name : "—"}</button>
                </div>
              );
            })}
          </div>

          {quote.fare_subtotal > 0 && (
            <div className="border-t pt-4 text-sm space-y-1.5">
              <h3 className="font-semibold mb-2">Summary</h3>
              <div className="flex justify-between"><span className="text-muted-foreground">Fare ({quote.guests} guest{quote.guests === 1 ? "" : "s"})</span><span>{money(quote.fare_subtotal, currency)}</span></div>
              {quote.discount > 0 && <div className="flex justify-between text-emerald-700"><span>{quote.promo?.label ?? quote.promo?.code}</span><span>-{money(quote.discount, currency)}</span></div>}
              {quote.addons_total > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Add-ons</span><span>{money(quote.addons_total, currency)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Taxes & fees</span><span>{money(quote.taxes_total, currency)}</span></div>
              <div className="flex justify-between font-semibold text-base pt-2 border-t"><span>Estimated total</span><span>{money(quote.total, currency)}</span></div>
              <div className="flex justify-between text-primary"><span>Deposit due today</span><span className="font-semibold">{money(quote.deposit_due, currency)}</span></div>
              {trip.final_payment_due && <p className="text-xs text-muted-foreground pt-1">Final payment due {fmtDate(trip.final_payment_due)}</p>}
            </div>
          )}
        </aside>

        {/* ── Main ── */}
        <main className="space-y-6">
          {step < 6 && <ProgressBar step={step} onJump={(s) => setStep(s)} />}

          {/* Step 0: Party size */}
          {step === 0 && (
            <section className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div><h1 className="text-2xl font-bold">Your trip starts here</h1><p className="text-muted-foreground">First, let's confirm the number of rooms and guests</p></div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"><Info className="h-3.5 w-3.5" /> All prices include taxes and fees</p>
              </div>
              {rooms.map((r, i) => {
                const cheapest = cfg.cabinOptions.filter((o) => !o.sold_out);
                const from = cheapest.length ? lowestPP(cheapest) : 0;
                return (
                  <div key={i} className="bg-background border rounded-lg p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-4">
                        <h2 className="text-lg font-semibold">Room {i + 1} Configuration</h2>
                        <div className="flex flex-wrap gap-6">
                          <div className="flex items-center gap-3"><div><div className="font-medium">Adults</div><div className="text-xs text-muted-foreground">Age 18+</div></div><Stepper value={r.adults} min={1} max={4} onChange={(n) => setRoom(i, { adults: n })} /></div>
                          <div className="flex items-center gap-3"><div><div className="font-medium">Children</div><div className="text-xs text-muted-foreground">Age 0–17</div></div><Stepper value={r.children} min={0} max={3} onChange={(n) => setRoom(i, { children: n })} /></div>
                        </div>
                        <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!r.accessible} onCheckedChange={(v) => setRoom(i, { accessible: !!v })} /> Wheelchair accessible <Accessibility className="h-4 w-4 text-muted-foreground" /></label>
                        {i === 0 && (
                          <div>
                            {!promoOpen ? <button type="button" className="text-sm text-primary font-medium underline-offset-2 hover:underline" onClick={() => setPromoOpen(true)}>Apply a promo code and exclusive rates</button>
                              : <div className="flex gap-2 max-w-xs"><Input placeholder="Promo code" value={promo} onChange={(e) => setPromo(e.target.value)} /><Tag className="h-4 w-4 self-center text-muted-foreground" /></div>}
                            {promo && quote && !quote.promo && <p className="text-xs text-destructive mt-1">That code isn't valid for this trip.</p>}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">Starting from</div>
                        <div className="text-2xl font-bold">{money(from, currency)} <span className="text-xs font-normal text-muted-foreground">/person*</span></div>
                        <div className="text-xs text-muted-foreground">{money(from * 2, currency)} Total/Room</div>
                      </div>
                    </div>
                    {rooms.length > 1 && <button type="button" className="text-xs text-muted-foreground mt-3 underline" onClick={() => setRooms((rs) => rs.filter((_, k) => k !== i))}>Remove room</button>}
                  </div>
                );
              })}
              {rooms.length < (trip.max_rooms_per_booking ?? 4) && (
                <Button variant="outline" onClick={() => setRooms((rs) => [...rs, emptyRoom()])}>Add another room <Plus className="h-4 w-4 ml-1" /></Button>
              )}
              <div className="flex justify-end pt-2"><Button size="lg" disabled={!canLeavePartySize} onClick={goRooms}>Continue to Room Selection <ChevronRight className="h-4 w-4 ml-1" /></Button></div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">*Starting from price is per person based on double occupancy in the lowest available category and includes group taxes and fees. Deposit is due at booking; the balance follows the payment schedule in your booking terms.</p>
            </section>
          )}

          {/* Step 1: Room selection (per room) */}
          {step === 1 && (
            <section className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div><h1 className="text-2xl font-bold">Select your room</h1>{rooms.length > 1 && <p className="text-muted-foreground">Room {roomIdx + 1} of {rooms.length} · {rooms[roomIdx].adults + rooms[roomIdx].children} guests</p>}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"><Info className="h-3.5 w-3.5" /> All prices include taxes and fees</p>
              </div>
              {/* category tabs */}
              <div className="bg-background border rounded-lg grid" style={{ gridTemplateColumns: `repeat(${Math.max(groups.length, 1)}, minmax(0,1fr))` }}>
                {groups.map(([g, opts]) => {
                  const soldOut = opts.every((o) => o.sold_out);
                  return (
                    <button key={g} type="button" onClick={() => !soldOut && setGroup(g)} className={`py-3 px-2 text-center border-b-2 transition-colors ${group === g ? "border-primary bg-primary/5" : "border-transparent"} ${soldOut ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"}`}>
                      <div className="font-semibold text-sm">{g}</div>
                      <div className={`text-xs ${soldOut ? "text-muted-foreground" : "text-primary"}`}>{soldOut ? "Sold out" : `From ${money(lowestPP(opts), currency)}*`}</div>
                    </button>
                  );
                })}
              </div>
              {(() => {
                const opts = (groups.find(([g]) => g === group)?.[1] ?? []);
                const room = rooms[roomIdx];
                const guestsInRoom = room.adults + room.children;
                return (
                  <>
                    <p className="text-sm text-muted-foreground">{opts.length} option{opts.length === 1 ? "" : "s"} available</p>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {opts.map((o) => {
                        const fits = guestsInRoom >= o.sleeps_min && guestsInRoom <= o.sleeps_max;
                        const accessibleOk = !room.accessible || o.accessible_available;
                        const disabled = o.sold_out || !fits || !accessibleOk;
                        const selected = room.cabin_option_id === o.id;
                        const imgs = o.images?.length ? o.images : o.image_url ? [o.image_url] : [];
                        const roomQuote = quoteBooking([{ ...room, cabin_option_id: o.id }], cfg.cabinOptions, [], [], { taxes_fees_per_person: Number(trip.taxes_fees_per_person ?? 0), group_deposit_per_person: trip.group_deposit_per_person, promo_codes: [] }).rooms[0];
                        return (
                          <div key={o.id} className={`bg-background border rounded-lg overflow-hidden flex flex-col ${selected ? "ring-2 ring-primary" : ""} ${disabled ? "opacity-60" : ""}`}>
                            <div className="relative aspect-[16/10] bg-muted">
                              {imgs[0] && <img src={imgs[0]} alt={o.category_name} className="absolute inset-0 w-full h-full object-cover" />}
                              {o.badge && <Badge className="absolute top-2 left-2">{o.badge}</Badge>}
                              {o.remaining != null && o.remaining > 0 && o.remaining <= 3 && <Badge variant="secondary" className="absolute top-2 right-2">Only {o.remaining} left</Badge>}
                            </div>
                            <div className="p-4 flex-1 flex flex-col gap-2">
                              <h3 className="text-lg font-semibold leading-tight">{o.category_name}</h3>
                              <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-0.5">
                                <li>Sleeps {o.sleeps_min}{o.sleeps_max > o.sleeps_min ? `-${o.sleeps_max}` : ""}.{o.sqft ? ` ${o.sqft} sq. ft.` : ""}{o.accessible_available ? " *Accessible" : ""}</li>
                                {(o.features ?? []).slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}
                              </ul>
                              {o.description && <p className="text-xs text-muted-foreground line-clamp-2">{o.description}</p>}
                              <div className="mt-auto pt-3 flex items-end justify-between">
                                <div>
                                  <div className="text-xs text-muted-foreground">Starting from</div>
                                  <div className="text-xl font-bold">{money(Number(o.price_per_person), currency)} <span className="text-xs font-normal text-muted-foreground">/person*</span></div>
                                  <div className="text-xs text-muted-foreground">{money(roomQuote.fare + roomQuote.taxes, currency)} Total/Room</div>
                                </div>
                                <Button size="sm" variant={selected ? "default" : "outline"} disabled={disabled} onClick={() => setRoom(roomIdx, { cabin_option_id: o.id })}>
                                  {o.sold_out ? "Sold out" : !fits ? `Sleeps ${o.sleeps_min}-${o.sleeps_max}` : !accessibleOk ? "Not accessible" : selected ? <><Check className="h-4 w-4 mr-1" />Selected</> : "Select"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => roomIdx > 0 ? setRoomIdx(roomIdx - 1) : setStep(0)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                {roomIdx < rooms.length - 1
                  ? <Button size="lg" disabled={!rooms[roomIdx].cabin_option_id} onClick={() => setRoomIdx(roomIdx + 1)}>Next room <ChevronRight className="h-4 w-4 ml-1" /></Button>
                  : <Button size="lg" disabled={!canLeaveRooms} onClick={() => setStep(cfg.addons.length ? 2 : 3)}>Continue <ChevronRight className="h-4 w-4 ml-1" /></Button>}
              </div>
            </section>
          )}

          {/* Step 2: Add-ons */}
          {step === 2 && (
            <section className="space-y-4">
              <div><h1 className="text-2xl font-bold">Make it yours</h1><p className="text-muted-foreground">Optional extras for your party. You can skip this step.</p></div>
              <div className="grid gap-4 md:grid-cols-2">
                {cfg.addons.map((a) => {
                  const qty = addonSel[a.id] ?? 0;
                  const basis = a.price_basis === "per_person" ? "per person" : a.price_basis === "per_room" ? "per room" : "per booking";
                  return (
                    <div key={a.id} className={`bg-background border rounded-lg p-4 flex gap-4 ${qty ? "ring-2 ring-primary" : ""}`}>
                      {a.image_url && <img src={a.image_url} alt="" className="h-20 w-20 rounded object-cover shrink-0" />}
                      <div className="flex-1">
                        <h3 className="font-semibold">{a.name}</h3>
                        {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                        <p className="text-sm mt-1"><span className="font-semibold">{money(Number(a.price), currency)}</span> <span className="text-muted-foreground">{basis}</span></p>
                      </div>
                      {a.price_basis === "per_booking"
                        ? <Stepper value={qty} min={0} max={10} onChange={(n) => setAddonSel({ ...addonSel, [a.id]: n })} />
                        : <Button size="sm" variant={qty ? "default" : "outline"} onClick={() => setAddonSel({ ...addonSel, [a.id]: qty ? 0 : 1 })}>{qty ? <><Check className="h-4 w-4 mr-1" />Added</> : "Add"}</Button>}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button size="lg" onClick={() => setStep(3)}>Continue to Review <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </section>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <section className="space-y-4">
              <div><h1 className="text-2xl font-bold">Review your trip</h1><p className="text-muted-foreground">Check the rooms and pricing before entering guest details.</p></div>
              {quote.rooms.map((rq, i) => {
                const o = rq.cabin_option_id ? optById.get(rq.cabin_option_id) : null;
                return (
                  <div key={i} className="bg-background border rounded-lg p-5">
                    <div className="flex justify-between items-start gap-4">
                      <div><h3 className="font-semibold">Room {i + 1}: {o?.category_group} · {o?.category_name}</h3><p className="text-sm text-muted-foreground">{rooms[i].adults} adult{rooms[i].adults === 1 ? "" : "s"}{rooms[i].children ? `, ${rooms[i].children} child${rooms[i].children === 1 ? "" : "ren"}` : ""}{rooms[i].accessible ? " · accessible" : ""}</p></div>
                      <button type="button" className="text-sm text-primary underline-offset-2 hover:underline" onClick={() => { setRoomIdx(i); setStep(1); }}>Change</button>
                    </div>
                    <table className="w-full text-sm mt-3">
                      <tbody>
                        {rq.breakdown.map((b) => <tr key={b.seat}><td className="py-0.5 text-muted-foreground">{b.label}</td><td className="py-0.5 text-right">{money(b.amount, currency)}</td></tr>)}
                        <tr><td className="py-0.5 text-muted-foreground">Taxes & fees</td><td className="py-0.5 text-right">{money(rq.taxes, currency)}</td></tr>
                        <tr className="font-semibold border-t"><td className="py-1">Room total</td><td className="py-1 text-right">{money(rq.fare + rq.taxes, currency)}</td></tr>
                        <tr className="text-primary"><td className="py-0.5">Deposit for this room</td><td className="py-0.5 text-right">{money(rq.deposit, currency)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {quote.addons_total > 0 && <div className="bg-background border rounded-lg p-5 text-sm"><h3 className="font-semibold mb-2">Add-ons</h3>{cfg.addons.filter((a) => addonSel[a.id]).map((a) => <div key={a.id} className="flex justify-between py-0.5"><span className="text-muted-foreground">{a.name}{a.price_basis === "per_booking" && addonSel[a.id] > 1 ? ` ×${addonSel[a.id]}` : ""}</span></div>)}<div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Add-ons total</span><span>{money(quote.addons_total, currency)}</span></div></div>}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 text-sm space-y-1">
                <div className="flex justify-between text-base font-semibold"><span>Estimated total</span><span>{money(quote.total, currency)}</span></div>
                <div className="flex justify-between text-primary font-semibold"><span>Due today (deposit)</span><span>{money(quote.deposit_due, currency)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Balance{trip.final_payment_due ? ` due ${fmtDate(trip.final_payment_due)}` : ""}</span><span>{money(quote.total - quote.deposit_due, currency)}</span></div>
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(cfg.addons.length ? 2 : 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button size="lg" onClick={() => setStep(4)}>Continue to Guest Info <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </section>
          )}

          {/* Step 4: Guest info */}
          {step === 4 && (
            <section className="space-y-4">
              <div><h1 className="text-2xl font-bold">Who's traveling?</h1><p className="text-muted-foreground">Names must match government ID. Dates of birth are required by the cruise line.</p></div>
              <div className="bg-background border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold">Lead guest &amp; contact</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>First name</Label><Input value={contact.first_name} onChange={(e) => { setContact({ ...contact, first_name: e.target.value }); }} /></div>
                  <div><Label>Last name</Label><Input value={contact.last_name} onChange={(e) => setContact({ ...contact, last_name: e.target.value })} /></div>
                  <div><Label>Email</Label><Input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
                </div>
              </div>
              {rooms.map((r, ri) => (
                <div key={ri} className="bg-background border rounded-lg p-5 space-y-4">
                  <h3 className="font-semibold">Room {ri + 1} · {optById.get(r.cabin_option_id!)?.category_name}</h3>
                  {r.guests.map((g, gi) => (
                    <div key={gi} className="grid sm:grid-cols-3 gap-3 border-t pt-3 first:border-0 first:pt-0">
                      <div className="sm:col-span-3 text-sm font-medium">{gi < r.adults ? `Adult ${gi + 1}` : `Child ${gi - r.adults + 1}`}{ri === 0 && gi === 0 ? " (lead guest)" : ""}</div>
                      <div><Label>First name</Label><Input value={g.first_name} onChange={(e) => { const guests = [...r.guests]; guests[gi] = { ...g, first_name: e.target.value }; setRoom(ri, { guests }); if (ri === 0 && gi === 0 && !contact.first_name) setContact({ ...contact, first_name: e.target.value }); }} /></div>
                      <div><Label>Last name</Label><Input value={g.last_name} onChange={(e) => { const guests = [...r.guests]; guests[gi] = { ...g, last_name: e.target.value }; setRoom(ri, { guests }); }} /></div>
                      <div><Label>Date of birth</Label><Input type="date" value={g.birthdate} onChange={(e) => { const guests = [...r.guests]; guests[gi] = { ...g, birthdate: e.target.value }; setRoom(ri, { guests }); }} /></div>
                    </div>
                  ))}
                </div>
              ))}
              <div className="bg-background border rounded-lg p-5 space-y-3">
                <label className="flex items-start gap-3 text-sm"><Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} className="mt-0.5" /><span>I agree to the booking terms{trip.group_terms ? "" : " and the supplier's cancellation policy"}.</span></label>
                {trip.group_terms && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer text-primary">Read the booking terms</summary><p className="whitespace-pre-wrap mt-2">{trip.group_terms}</p></details>}
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(3)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button size="lg" disabled={!guestsValid || !contactValid || !terms || submitting} onClick={submitBooking}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Continue to Payment <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </section>
          )}

          {/* Step 5: Pay */}
          {step === 5 && booking && (
            <section className="space-y-4">
              <div><h1 className="text-2xl font-bold">Pay your deposit</h1><p className="text-muted-foreground">Booking reference <span className="font-mono font-semibold">{booking.booking_ref}</span>. Your rooms are held while you pay.</p></div>
              <div className="bg-background border rounded-lg p-5">
                {!stripePromise
                  ? <p className="text-sm text-destructive">Online payment isn't configured yet. Your advisor will contact you at {contact.email} to collect the deposit.</p>
                  : <Elements stripe={stripePromise} options={{ clientSecret: booking.clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: primary } } }}>
                      <PayForm depositCents={booking.deposit_cents} currency={currency} onPaid={() => setStep(6)} />
                    </Elements>}
              </div>
            </section>
          )}

          {/* Step 6: Confirmation */}
          {step === 6 && booking && (
            <section className="bg-background border rounded-lg p-8 text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 grid place-items-center"><Check className="h-7 w-7 text-emerald-600" /></div>
              <h1 className="text-2xl font-bold">You're booked!</h1>
              <p className="text-muted-foreground">Deposit of {money(booking.deposit_cents / 100, currency)} received for reference <span className="font-mono font-semibold">{booking.booking_ref}</span>. A receipt is on its way to {contact.email}, and {cfg.advisor?.full_name || "your advisor"} will follow up with the rest of the details.</p>
              <Button asChild variant="outline"><Link to={`/group/${token}`}>Back to the trip page</Link></Button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
