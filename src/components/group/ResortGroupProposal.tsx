import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { BedDouble, CalendarDays, Check, ChevronRight, Crown, Hotel, MapPin, Plane, Users } from "lucide-react";
import crestwellLogo from "@/assets/CTN-Logo.png";
import heroImage from "@/assets/cancun-zilara-hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, Images } from "lucide-react";
import { money } from "@/lib/hawaiiProposal";
import { CABIN_CLASSES, FLIGHT_CHOICES, WAMSLEY_PROPOSAL_CONFIG, type ResortGroupProposalConfig } from "@/lib/resortGroupProposal";
import { toast } from "sonner";

export function ResortGroupProposal({ token, data }: { token: string; data: any }) {
  const config = (data.trip.group_landing_content?.proposal_config || WAMSLEY_PROPOSAL_CONFIG) as ResortGroupProposalConfig;
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({
    date_id: "", room_id: "", guests_per_room: "", guest_names: [] as string[],
    email: "", phone: "", flight_choice: "", departure_airport: "", cabin_class: "economy", flight_notes: "",
    special_requests: "", additional_comments: "", payment_preference: "undecided",
  });
  const setField = (key: string, value: string) => setForm((c) => ({ ...c, [key]: value }));

  const date = config.dates.find((d) => d.id === form.date_id);
  const room = config.rooms.find((r) => r.id === form.room_id);
  const guests = Number(form.guests_per_room) || 0;
  const knownPrice = room && date ? room.pricesByDate[date.id] : undefined;
  const names = Array.from({ length: guests }, (_, i) => form.guest_names[i] || "");
  const namesComplete = guests > 0 && names.every((n) => n.trim().length > 1);
  const flightsOk = form.flight_choice && (form.flight_choice !== "need_flights" || form.departure_airport.trim().length >= 3);
  const canSubmit = !!date && !!room && guests >= (room?.minGuests || 1) && guests <= (room?.maxGuests || 0) && namesComplete && !!form.email.trim() && !!flightsOk && accepted;

  const pickRoom = (id: string) => {
    const r = config.rooms.find((x) => x.id === id);
    setForm((c) => ({ ...c, room_id: id, guests_per_room: r && Number(c.guests_per_room) > r.maxGuests ? "" : c.guests_per_room }));
  };
  const setName = (i: number, value: string) => setForm((c) => { const next = [...c.guest_names]; next[i] = value; return { ...c, guest_names: next }; });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) { toast.error("Choose dates, a room, guests per room with names, flight preference, and accept the terms."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/group-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ token, action: "submit_resort_selection", ...form, guest_names: names, guests_per_room: guests, disclosure_accepted: accepted }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to submit selections");
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to submit selections");
    } finally { setSubmitting(false); }
  };

  if (submitted) {
    return <main className="min-h-screen bg-background flex items-center justify-center px-5 py-16">
      <section className="max-w-2xl w-full bg-card border border-border rounded-lg p-8 md:p-12 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-success/10 text-success flex items-center justify-center"><Check className="h-7 w-7" /></div>
        <h1 className="font-display text-3xl text-primary mt-6">Your room request is with Crestwell</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">Your advisor will confirm availability, final pricing{form.flight_choice === "need_flights" ? ", flight options" : ""} and cancellation terms before anything is booked or charged.</p>
        <p className="text-sm font-semibold text-primary mt-6">A copy has been sent to {form.email}.</p>
      </section>
    </main>;
  }

  return <main className="min-h-screen bg-background text-foreground hawaii-proposal">
    <Helmet>
      <title>{config.title} | Crestwell Travel Services</title>
      <meta name="description" content={`Choose your dates and suite at ${config.hotel.name} for the ${config.title}.`} />
      <meta property="og:title" content={`${config.title} | Crestwell Travel Services`} />
      <meta property="og:description" content={`Choose your dates and suite at ${config.hotel.name}.`} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
    </Helmet>

    <header className="relative min-h-[560px] md:min-h-[660px] overflow-hidden flex items-end">
      <img src={heroImage} alt="Oceanfront pool and beach in Cancun" width={1920} height={1088} loading="eager" decoding="async" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-primary/55" />
      <div className="relative w-full max-w-7xl mx-auto px-5 md:px-10 pb-12 md:pb-16 text-primary-foreground">
        <img src={data.branding?.logo_url || crestwellLogo} alt="Crestwell Travel Services" className="h-20 md:h-28 w-auto object-contain object-left mb-8" />
        <p className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-accent">{config.kicker}</p>
        <h1 className="font-display text-5xl md:text-7xl font-semibold mt-3">{config.title}</h1>
        <p className="max-w-2xl text-lg md:text-xl mt-4 text-primary-foreground/90 leading-relaxed">{config.intro}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7 text-sm font-medium">
          <span className="flex items-center gap-2"><Hotel className="h-4 w-4 text-accent" /> {config.hotel.name}</span>
          <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-accent" /> {config.dates.map((d) => d.label).join(" or ")}</span>
          <span className="flex items-center gap-2"><Plane className="h-4 w-4 text-accent" /> Flight quotes available</span>
        </div>
      </div>
    </header>

    <section className="max-w-7xl mx-auto px-5 md:px-10 py-14 md:py-20">
      <p className="section-kicker">Featured resort</p>
      <h2 className="font-display text-3xl md:text-5xl text-primary mt-2">{config.hotel.name}</h2>
      <p className="flex items-center gap-2 text-muted-foreground mt-3"><MapPin className="h-4 w-4 text-accent" /> {config.hotel.location}</p>
      <p className="text-muted-foreground mt-4 max-w-3xl leading-relaxed">{config.hotel.summary}</p>
      <ul className="flex flex-wrap gap-2 mt-6">{config.hotel.highlights.map((h) => <li key={h} className="text-sm border border-border rounded-full px-4 py-1.5 bg-card">{h}</li>)}</ul>
      <div className="mt-10 overflow-x-auto border border-border rounded-lg bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-primary text-primary-foreground"><tr><th className="p-4 text-left">Suite</th><th className="p-4 text-left">Guests per room</th>{config.dates.map((d) => <th key={d.id} className="p-4 text-right"><span className="block">{d.label}</span><span className="text-xs font-normal text-primary-foreground/70">{d.nights} nights · from</span></th>)}</tr></thead>
          <tbody>{config.rooms.map((r) => <tr key={r.id} className="border-t border-border"><td className="p-4"><span className="font-semibold">{r.name}</span>{r.reservedFor && <span className="ml-2 text-[10px] uppercase font-bold text-accent">{r.reservedFor}</span>}<span className="block text-xs text-muted-foreground mt-1">{r.details}</span>{!!r.photos?.length && <button type="button" onClick={() => setGallery({ room: r.name, photos: r.photos!, index: 0 })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"><Images className="h-3.5 w-3.5" />View {r.photos.length} photos</button>}</td><td className="p-4">{r.minGuests}–{r.maxGuests}</td>{config.dates.map((d) => { const p = r.pricesByDate[d.id]; return <td key={d.id} className="p-4 text-right tabular-nums">{p ? <><strong>{money(p)}</strong><span className="block text-xs text-muted-foreground">1 guest + taxes</span></> : <span className="text-muted-foreground">Advisor to confirm</span>}</td>; })}</tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">Prices are estimates we found for 1 guest and are not guaranteed. Shared-room pricing, taxes and availability are confirmed before booking.</p>
    </section>

    <form onSubmit={submit}>
      <section className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-5 md:px-10 py-14 md:py-20">
          <p className="section-kicker">Reserve your spot</p>
          <h2 className="font-display text-3xl md:text-5xl text-primary mt-2">Build your stay.</h2>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10 mt-10 items-start">
            <div className="space-y-10">
              <fieldset><legend className="proposal-step-title"><span>1</span>Choose your dates</legend>
                <div className="grid md:grid-cols-2 gap-4 mt-4">{config.dates.map((d) => <button type="button" key={d.id} onClick={() => setField("date_id", d.id)} aria-pressed={form.date_id === d.id} className={`proposal-choice ${form.date_id === d.id ? "proposal-choice-active" : ""}`}><CalendarDays className="h-5 w-5" /><span><strong>{d.label}</strong><small>Thursday–Sunday · {d.nights} nights</small></span></button>)}</div>
              </fieldset>
              <fieldset><legend className="proposal-step-title"><span>2</span>Choose your room</legend>
                <div className="grid sm:grid-cols-3 gap-3 mt-4">{config.rooms.map((r) => { const p = form.date_id ? r.pricesByDate[form.date_id] : undefined; return <button type="button" key={r.id} onClick={() => pickRoom(r.id)} aria-pressed={form.room_id === r.id} className={`proposal-choice items-start ${form.room_id === r.id ? "proposal-choice-active" : ""}`}>{r.reservedFor ? <Crown className="h-5 w-5 shrink-0" /> : <BedDouble className="h-5 w-5 shrink-0" />}<span><strong>{r.name}</strong>{r.reservedFor && <small className="text-accent font-semibold">{r.reservedFor}</small>}<small>{r.details}</small><small>Up to {r.maxGuests} guests · {p ? `from ${money(p)}` : "price to confirm"}</small></span></button>; })}</div>
              </fieldset>
              <fieldset><legend className="proposal-step-title"><span>3</span>Guests in this room</legend>
                {!room ? <p className="proposal-empty">Choose a room first.</p> : <div className="mt-4 space-y-4">
                  <div className="max-w-xs"><Label htmlFor="guests-per-room" className="font-semibold">Guests per room *</Label>
                    <select id="guests-per-room" required value={form.guests_per_room} onChange={(e) => setField("guests_per_room", e.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Select…</option>
                      {Array.from({ length: room.maxGuests - room.minGuests + 1 }, (_, i) => room.minGuests + i).map((n) => <option key={n} value={n}>{n} guest{n === 1 ? "" : "s"}</option>)}
                    </select></div>
                  {guests > 0 && <div className="grid sm:grid-cols-2 gap-4">{names.map((n, i) => <div key={i}><Label htmlFor={`guest-${i}`}>Guest {i + 1} full name (as on passport) *</Label><Input id={`guest-${i}`} required autoComplete={i === 0 ? "name" : "off"} value={n} onChange={(e) => setName(i, e.target.value)} className="mt-2" /></div>)}</div>}
                </div>}
              </fieldset>
              <fieldset><legend className="proposal-step-title"><span>4</span>Flights</legend>
                <div className="grid md:grid-cols-3 gap-3 mt-4">{FLIGHT_CHOICES.map(([id, label]) => <button type="button" key={id} onClick={() => setField("flight_choice", id)} aria-pressed={form.flight_choice === id} className={`proposal-choice ${form.flight_choice === id ? "proposal-choice-active" : ""}`}><Plane className="h-5 w-5 shrink-0" /><span><strong>{label}</strong></span></button>)}</div>
                {form.flight_choice === "need_flights" && <div className="grid md:grid-cols-3 gap-4 mt-4">
                  <div><Label htmlFor="dep-airport">Departure airport or city *</Label><Input id="dep-airport" value={form.departure_airport} onChange={(e) => setField("departure_airport", e.target.value)} placeholder="e.g. CHS or Charleston" className="mt-2" /></div>
                  <div><Label htmlFor="cabin-class">Cabin</Label><select id="cabin-class" value={form.cabin_class} onChange={(e) => setField("cabin_class", e.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{CABIN_CLASSES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></div>
                  <div><Label htmlFor="flight-notes">Flight notes</Label><Input id="flight-notes" value={form.flight_notes} onChange={(e) => setField("flight_notes", e.target.value)} placeholder="Preferred times, airline, bags" className="mt-2" /></div>
                </div>}
                <p className="text-sm text-muted-foreground mt-3">Flights arrive at Cancun International (CUN). Your advisor sends live fares for your chosen dates — none are held until you approve.</p>
              </fieldset>
            </div>
            <aside className="lg:sticky lg:top-6 border border-border bg-background rounded-lg p-6">
              <p className="text-xs uppercase font-bold tracking-[0.15em] text-accent">Your selection</p>
              <div className="space-y-3 mt-5 text-sm">
                <Line label="Dates" value={date?.label} />
                <Line label="Room" value={room?.name} />
                <Line label="Guests in room" value={guests ? String(guests) : undefined} />
                <Line label="Flights" value={FLIGHT_CHOICES.find(([id]) => id === form.flight_choice)?.[1]} />
              </div>
              <div className="border-t-2 border-accent mt-5 pt-5 flex justify-between gap-4"><span className="font-semibold">Room estimate</span><strong className="font-display text-2xl text-primary tabular-nums">{knownPrice ? money(knownPrice) : "—"}</strong></div>
              <p className="text-xs text-muted-foreground mt-2">{room ? room.pricingNote : "Choose dates and a room to see the estimate."}</p>
              <div className="bg-muted p-4 mt-5 rounded-md text-xs leading-relaxed"><Users className="h-4 w-4 inline mr-1" /> Every guest sharing the room must be listed so the resort can register them.</div>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-5 md:px-10 py-14 md:py-20">
          <h2 className="font-display text-4xl md:text-5xl">Send your request to Crestwell.</h2>
          <p className="text-primary-foreground/75 mt-4 max-w-2xl">This is a request for advisor review — not a booking or payment.</p>
          <div className="grid md:grid-cols-2 gap-5 mt-10">
            <Field label="Email *" id="email"><Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className="bg-card text-foreground" /></Field>
            <Field label="Phone" id="phone"><Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} className="bg-card text-foreground" /></Field>
            <Field label="How would you like to pay?" id="pay"><select id="pay" value={form.payment_preference} onChange={(e) => setField("payment_preference", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background text-foreground px-3"><option value="planned_payments">Planned payments</option><option value="flexpay">Uplift FlexPay</option><option value="affirm">Affirm</option><option value="undecided">Not sure yet</option></select></Field>
            <Field label="Special requests" id="sr"><Textarea id="sr" rows={2} value={form.special_requests} onChange={(e) => setField("special_requests", e.target.value)} className="bg-card text-foreground" /></Field>
            <div className="md:col-span-2"><Field label="Anything else?" id="ac"><Textarea id="ac" rows={3} value={form.additional_comments} onChange={(e) => setField("additional_comments", e.target.value)} className="bg-card text-foreground" /></Field></div>
          </div>
          <div className="bg-primary-foreground/10 border border-primary-foreground/20 rounded-md p-5 mt-8 flex gap-3 items-start">
            <Checkbox id="disclosure" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-1 border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground" />
            <Label htmlFor="disclosure" className="text-sm leading-relaxed text-primary-foreground cursor-pointer">I understand prices and availability can change until booked and confirmed. Taxes, resort fees, airfare and other charges are confirmed separately before payment.</Label>
          </div>
          <Button type="submit" size="lg" disabled={!canSubmit || submitting} className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90 min-h-12 h-auto px-8 py-3">{submitting ? "Submitting…" : "Submit my room request"}<ChevronRight className="ml-2 h-5 w-5" /></Button>
        </div>
      </section>
    </form>
  </main>;
}

function Line({ label, value }: { label: string; value?: string }) {
  return <div className="flex justify-between gap-4 border-b border-border pb-3"><span className="text-muted-foreground">{label}</span><strong className="text-right">{value || "—"}</strong></div>;
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id} className="text-primary-foreground">{label}</Label>{children}</div>;
}
