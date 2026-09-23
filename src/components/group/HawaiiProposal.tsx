import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Anchor, CalendarDays, Check, ChevronRight, CircleDollarSign, Hotel, Info, MapPin, Ship, Sparkles, Users } from "lucide-react";
import crestwellLogo from "@/assets/CTN-Logo.png";
import hawaiiHero from "@/assets/hawaii-2027-hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HAWAII_PROPOSAL_CONFIG, type HawaiiProposalConfig, money } from "@/lib/hawaiiProposal";
import { toast } from "sonner";

interface HawaiiProposalProps {
  token: string;
  data: any;
}

const confirmationItems = [
  "Hotel taxes and other property charges",
  "Rate-specific hotel payment and cancellation terms",
  "Cruise taxes, port expenses, and any fare components not shown",
  "NCL daily service charges and Hawaii GET tax",
  "Free at Sea benefits, eligibility, package charges, and gratuities for this booking",
  "Free at Sea Plus price and eligibility for this sailing",
  "Group amenities, cabin minimums, combinability, and dollar values",
  "Excursion availability and final prices",
];

const excursions = [
  { port: "Maui", examples: "Road to Hana, Haleakalā sunrise, waterfall and rainforest tours", range: "Approx. $120–$350+", duration: "5–10 hours", experience: "Volcanic landscapes, coastal roads, waterfalls and local culture." },
  { port: "Hilo", examples: "Hawaiʻi Volcanoes National Park, waterfalls, botanical gardens", range: "Approx. $100–$300+", duration: "4–8 hours", experience: "Lava fields, rainforest scenery and the island’s volcanic history." },
  { port: "Kona", examples: "Snorkeling, coffee-country tour, historic Kona", range: "Approx. $90–$250+", duration: "3–6 hours", experience: "Clear-water marine life, Kona coffee farms and historic coastal sites." },
  { port: "Kauai", examples: "Waimea Canyon, Nā Pali Coast, river and waterfall experiences", range: "Approx. $110–$400+", duration: "4–8 hours", experience: "Dramatic canyons, sea cliffs, tropical valleys and waterfalls." },
];

export function HawaiiProposal({ token, data }: HawaiiProposalProps) {
  const config = (data.trip.group_landing_content?.proposal_config || HAWAII_PROPOSAL_CONFIG) as HawaiiProposalConfig;
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({
    traveler_name: "", second_traveler_name: "", email: "", phone: "", party_size: "2",
    sailing_id: "", cabin_id: "", hotel_id: "", hotel_room_id: "",
    free_at_sea_selection: "need_assistance", service_charges_selection: "review",
    excursions_selection: "need_assistance", special_requests: "", accessibility_requirements: "", additional_comments: "",
  });

  const sailing = config.sailings.find((item) => item.id === form.sailing_id);
  const cabin = sailing?.cabins.find((item) => item.id === form.cabin_id);
  const hotel = config.hotels.find((item) => item.id === form.hotel_id);
  const room = hotel?.rooms.find((item) => item.id === form.hotel_room_id);
  const partySize = Math.max(1, Number(form.party_size) || 2);
  const hotelPrepaidTotal = room ? room.prepaidTotal ?? room.nightlyRate * room.nights : 0;
  const hotelRefund = room?.postCheckoutRefund || 0;
  const hotelKnownTotal = room ? hotelPrepaidTotal + room.knownPayAtProperty - hotelRefund : 0;
  const knownTotal = (cabin?.cabinTotal || 0) + hotelKnownTotal;
  const perPerson = knownTotal / partySize;
  const serviceChargeEstimate = cabin ? cabin.serviceChargePerPersonPerDay * partySize * config.cruiseNights : 0;
  const freeAtSeaStandardEstimate = config.freeAtSeaStandardPerPersonPerDay * partySize * config.cruiseNights;
  const freeAtSeaPlusEstimate = config.freeAtSeaPlusPerPersonPerDay * partySize * config.cruiseNights;
  const selectedFreeAtSeaEstimate = form.free_at_sea_selection === "plus" ? freeAtSeaPlusEstimate : form.free_at_sea_selection === "standard" ? freeAtSeaStandardEstimate : 0;
  const estimatedPrepaidTotal = serviceChargeEstimate + selectedFreeAtSeaEstimate;
  const canReview = !!sailing && !!cabin && !!hotel && !!room;
  const setField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canReview || !form.traveler_name.trim() || !form.email.trim() || !accepted) {
      toast.error("Complete your selections, contact details, and cost acknowledgment.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/group-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ token, action: "submit_proposal_selection", ...form, disclosure_accepted: accepted }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to submit selections");
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit selections");
    } finally {
      setSubmitting(false);
    }
  };

  const scenarioRows = useMemo(() => {
    const first = config.sailings[0];
    const byCabin = (id: string) => first.cabins.find((item) => item.id === id)?.cabinTotal || 0;
    const byRoom = (hotelId: string, roomId: string) => {
      const selectedRoom = config.hotels.find((item) => item.id === hotelId)?.rooms.find((item) => item.id === roomId);
      return selectedRoom ? (selectedRoom.prepaidTotal ?? selectedRoom.nightlyRate * selectedRoom.nights) + selectedRoom.knownPayAtProperty - (selectedRoom.postCheckoutRefund || 0) : 0;
    };
    return [
      ["Balcony + Hilton Ocean View", byCabin("balcony") + byRoom("hilton-hawaiian-village", "king-deluxe-ocean")],
      ["Inside + Ramada Standard King", byCabin("inside") + byRoom("ramada-plaza-waikiki", "standard-king")],
      ["Oceanview + OUTRIGGER", byCabin("oceanview") + byRoom("outrigger-waikiki-paradise", "standard-queen")],
      ["Balcony + Ramada Balcony/City View", byCabin("balcony") + byRoom("ramada-plaza-waikiki", "balcony-city-double")],
    ] as const;
  }, [config]);

  if (submitted) {
    return <main className="min-h-screen bg-background flex items-center justify-center px-5 py-16">
      <section className="max-w-2xl w-full bg-card border border-border rounded-lg p-8 md:p-12 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-success/10 text-success flex items-center justify-center"><Check className="h-7 w-7" /></div>
        <h1 className="font-display text-3xl text-primary mt-6">Your Hawaii selections are with Crestwell</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">Your advisor will verify availability, promotions, taxes, service charges, group benefits, and cancellation terms before anything is booked or charged.</p>
        <p className="text-sm font-semibold text-primary mt-6">A copy has been sent to {form.email}.</p>
      </section>
    </main>;
  }

  return <main className="min-h-screen bg-background text-foreground hawaii-proposal">
    <Helmet>
      <title>Hawaii 2027 | Crestwell Travel Services</title>
      <meta name="description" content="Build your 2027 Pride of America Hawaii group vacation with Crestwell Travel Services." />
      <meta property="og:title" content="Hawaii 2027 | Crestwell Travel Services" />
      <meta property="og:description" content="Choose your sailing, cabin, and Waikiki hotel for a custom Hawaii group vacation." />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
    </Helmet>

    <header className="relative min-h-[560px] md:min-h-[660px] overflow-hidden flex items-end">
      <img src={hawaiiHero} alt="Hawaiian coastline and inter-island cruise ship" width={1920} height={1080} loading="eager" decoding="async" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-primary/55" />
      <div className="relative w-full max-w-7xl mx-auto px-5 md:px-10 pb-12 md:pb-16 text-primary-foreground">
        <img src={data.branding?.logo_url || crestwellLogo} alt="Crestwell Travel Services" className="h-20 md:h-28 w-auto object-contain object-left mb-8" />
        <p className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-accent">Pride of America · 7-Day Inter-Island Cruise</p>
        <h1 className="font-display text-5xl md:text-7xl font-semibold mt-3">Hawaii 2027</h1>
        <p className="max-w-2xl text-lg md:text-xl mt-4 text-primary-foreground/90 leading-relaxed">Build your own Hawaii vacation while traveling with the group. Choose your sailing, stateroom, and two-night Waikiki stay independently.</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7 text-sm font-medium">
          <span className="flex items-center gap-2"><Ship className="h-4 w-4 text-accent" /> Round-trip Honolulu</span>
          <span className="flex items-center gap-2"><Hotel className="h-4 w-4 text-accent" /> 2 nights in Waikiki</span>
          <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-accent" /> Two spring sailings</span>
        </div>
      </div>
    </header>


    <nav className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
        {["Compare", "Build", "Perks & costs", "Submit"].map((label, index) => <button key={label} type="button" onClick={() => { setStep(index + 1); document.getElementById(index === 0 ? "compare" : index === 1 ? "builder" : index === 2 ? "details" : "submit")?.scrollIntoView({ behavior: "smooth" }); }} className={`shrink-0 px-4 py-2 text-sm font-semibold border-b-2 ${step === index + 1 ? "border-accent text-primary" : "border-transparent text-muted-foreground"}`}>{index + 1}. {label}</button>)}
      </div>
    </nav>

    <section id="compare" className="max-w-7xl mx-auto px-5 md:px-10 py-14 md:py-20 scroll-mt-20">
      <p className="section-kicker">Choose your sailing</p>
      <h2 className="font-display text-3xl md:text-5xl text-primary mt-2">Two dates. Your preferred cabin.</h2>
      <p className="text-muted-foreground mt-4 max-w-3xl">Prices shown are for two adults sharing one cabin. Neither sailing is ranked; compare the exact supplied prices.</p>
      <div className="mt-8 overflow-x-auto border border-border rounded-lg bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-primary text-primary-foreground"><tr><th className="p-4 text-left">Stateroom</th>{config.sailings.map((item) => <th key={item.id} className="p-4 text-right"><span className="block font-semibold">{item.label}</span><span className="text-xs font-normal text-primary-foreground/70">per person · cabin total</span></th>)}</tr></thead>
          <tbody>{config.sailings[0].cabins.map((baseCabin) => <tr key={baseCabin.id} className="border-t border-border"><td className="p-4"><span className="font-semibold">{baseCabin.name}</span>{baseCabin.primary && <span className="ml-2 text-[10px] uppercase font-bold text-accent">Primary choice</span>}</td>{config.sailings.map((item) => { const price = item.cabins.find((candidate) => candidate.id === baseCabin.id); return <td key={item.id} className="p-4 text-right tabular-nums"><strong>{money(price?.perPerson || 0)}</strong><span className="text-muted-foreground"> · {money(price?.cabinTotal || 0)}</span></td>; })}</tr>)}</tbody>
        </table>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-5 text-sm">
        <div className="border-l-2 border-accent pl-4"><strong>Inside:</strong> March 20 is $53 less per person / $106 less per cabin.</div>
        <div className="border-l-2 border-accent pl-4"><strong>Oceanview:</strong> March 20 is $32 less per person / $64 less per cabin.</div>
        <div className="border-l-2 border-accent pl-4"><strong>Balcony:</strong> Same price on both sailings — $3,043 per person.</div>
      </div>
    </section>

    <form onSubmit={submit}>
      <section id="builder" className="bg-card border-y border-border scroll-mt-20">
        <div className="max-w-7xl mx-auto px-5 md:px-10 py-14 md:py-20">
          <p className="section-kicker">Build your Hawaii vacation</p>
          <h2 className="font-display text-3xl md:text-5xl text-primary mt-2">Mix and match every part.</h2>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10 mt-10 items-start">
            <div className="space-y-10">
              <fieldset><legend className="proposal-step-title"><span>1</span>Select your sailing</legend><div className="grid md:grid-cols-2 gap-4 mt-4">{config.sailings.map((item) => <button type="button" key={item.id} onClick={() => setForm((current) => ({ ...current, sailing_id: item.id, cabin_id: "" }))} className={`proposal-choice ${form.sailing_id === item.id ? "proposal-choice-active" : ""}`}><CalendarDays className="h-5 w-5" /><span><strong>{item.label}</strong><small>Saturday–Saturday · 7 nights<br />Waikiki: {item.hotelCheckIn.slice(5).replace("-", "/")}–{item.hotelCheckOut.slice(5).replace("-", "/")}</small></span></button>)}</div></fieldset>
              <fieldset><legend className="proposal-step-title"><span>2</span>Select your cabin</legend>{!sailing ? <p className="proposal-empty">Choose a sailing first.</p> : <div className="grid sm:grid-cols-2 gap-3 mt-4">{sailing.cabins.map((item) => <button type="button" key={item.id} onClick={() => setField("cabin_id", item.id)} className={`proposal-choice ${form.cabin_id === item.id ? "proposal-choice-active" : ""}`}><Anchor className="h-5 w-5" /><span><strong>{item.name}</strong><small>{money(item.perPerson)} per person · {money(item.cabinTotal)} for two</small></span></button>)}</div>}</fieldset>
              <fieldset><legend className="proposal-step-title"><span>3</span>Select your Waikiki hotel</legend><div className="grid md:grid-cols-3 gap-3 mt-4">{config.hotels.map((item) => <button type="button" key={item.id} onClick={() => setForm((current) => ({ ...current, hotel_id: item.id, hotel_room_id: "" }))} className={`proposal-choice items-start ${form.hotel_id === item.id ? "proposal-choice-active" : ""}`}><Hotel className="h-5 w-5 shrink-0" /><span><strong>{item.name}</strong><small>{item.summary}</small></span></button>)}</div></fieldset>
               <fieldset><legend className="proposal-step-title"><span>4</span>Select your hotel room</legend>{!hotel ? <p className="proposal-empty">Choose a hotel first.</p> : <div className="grid sm:grid-cols-2 gap-3 mt-4">{hotel.rooms.map((item) => <button type="button" key={item.id} onClick={() => setField("hotel_room_id", item.id)} className={`proposal-choice ${form.hotel_room_id === item.id ? "proposal-choice-active" : ""}`}><span><strong>{item.name}</strong>{item.details && <small>{item.details}</small>}{item.prepaidTotal ? <small>Payment total: {money(item.prepaidTotal)} USD{item.includedTaxes ? ` · includes ${money(item.includedTaxes)} occupancy tax` : ""}</small> : <small>{money(item.nightlyRate)}/night · {money(item.nightlyRate * item.nights)} base for 2 nights</small>}{item.knownPayAtProperty > 0 && <small>Due upon arrival: {money(item.knownPayAtProperty)}</small>}{item.postCheckoutRefund ? <small>Refunded after check-out — {item.refundLabel}: {money(item.postCheckoutRefund)}</small> : null}</span></button>)}</div>}</fieldset>
              <fieldset><legend className="proposal-step-title"><span>5</span>Review your preferences</legend><div className="grid md:grid-cols-3 gap-4 mt-4">
                <ChoiceSelect label="Free at Sea" value={form.free_at_sea_selection} onChange={(value) => setField("free_at_sea_selection", value)} options={[["standard","Standard"],["plus","Free at Sea Plus"],["need_assistance","Need assistance deciding"]]} />
                <ChoiceSelect label="Service charges" value={form.service_charges_selection} onChange={(value) => setField("service_charges_selection", value)} options={[["prepay","Prepay if available"],["review","Review with Crestwell"]]} />
                <ChoiceSelect label="Excursions" value={form.excursions_selection} onChange={(value) => setField("excursions_selection", value)} options={[["interested","Interested"],["not_interested","Not interested"],["need_assistance","Need assistance selecting"]]} />
                <ChoiceSelect label="How would you like to pay?" value={form.payment_preference} onChange={(value) => setField("payment_preference", value)} options={[["planned_payments","Planned payments (scheduled installments)"],["flexpay","Uplift FlexPay (monthly financing)"],["affirm","Affirm (pay over time)"],["undecided","Not sure yet — discuss with my advisor"]]} />
              </div>
              <p className="text-sm text-muted-foreground mt-4">Choosing an option here is a preference only. Your advisor will send the matching payment link after final pricing is confirmed; financing options are subject to provider approval.</p></fieldset>

            </div>

            <aside className="lg:sticky lg:top-20 border border-border bg-background rounded-lg p-6">
              <p className="text-xs uppercase font-bold tracking-[0.15em] text-accent">Live cost summary</p>
              <h3 className="font-display text-2xl text-primary mt-2">Known costs</h3>
              <div className="space-y-3 mt-6 text-sm">
                <CostLine label={cabin?.name || "Cruise cabin"} value={cabin?.cabinTotal} />
                 <CostLine label={room ? `${room.name} · payment total` : "Waikiki hotel"} value={room ? hotelPrepaidTotal : undefined} />
                {room && room.knownPayAtProperty > 0 && <CostLine label="Known pay-at-property amount" value={room.knownPayAtProperty} />}
                 {room && room.postCheckoutRefund ? <CostLine label={`Refund after check-out · ${room.refundLabel || "Refund"}`} value={-room.postCheckoutRefund} /> : null}
              </div>
              <div className="border-t-2 border-accent mt-5 pt-5 flex justify-between gap-4"><span className="font-semibold">Estimated known total</span><strong className="font-display text-2xl text-primary tabular-nums">{money(knownTotal)}</strong></div>
              {knownTotal > 0 && <p className="text-right text-sm text-muted-foreground mt-1">{money(perPerson)} per person for {form.party_size}</p>}

              {cabin && (
                <>
                  <div className="border-t border-border mt-5 pt-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Estimated prepaid charges before sailing</p>
                    <div className="space-y-2 mt-3 text-sm">
                      <CostLine label={`NCL daily service charge · ${money(cabin.serviceChargePerPersonPerDay)}/person/day`} value={serviceChargeEstimate} />
                      {form.free_at_sea_selection === "plus" ? (
                        <CostLine label={`Free at Sea Plus · ${money(config.freeAtSeaPlusPerPersonPerDay)}/person/day`} value={freeAtSeaPlusEstimate} />
                      ) : form.free_at_sea_selection === "standard" ? (
                        <CostLine label={`Standard Free at Sea · ${money(config.freeAtSeaStandardPerPersonPerDay)}/person/day`} value={freeAtSeaStandardEstimate} />
                      ) : (
                        <div className="flex justify-between gap-4 border-b border-border pb-3"><span className="text-muted-foreground">Free at Sea package</span><span className="tabular-nums text-muted-foreground">—</span></div>
                      )}
                    </div>
                    <div className="flex justify-between gap-4 mt-4"><span className="font-semibold text-sm">Estimated prepaid total</span><strong className="font-display text-xl text-primary tabular-nums">{money(estimatedPrepaidTotal)}</strong></div>
                  </div>
                  <div className="bg-muted p-4 mt-5 rounded-md"><p className="text-xs font-bold uppercase text-muted-foreground">Requires confirmation</p><p className="text-xs mt-2 leading-relaxed">Hotel taxes, cruise taxes/port expenses, service charges, Free at Sea, group benefits, excursions, and cancellation terms are estimated and must be verified before booking.</p></div>
                </>
              )}
            </aside>
          </div>
        </div>
      </section>

      <section id="details" className="max-w-7xl mx-auto px-5 md:px-10 py-14 md:py-20 scroll-mt-20">
        <p className="section-kicker">Perks, excursions and extra costs</p>
        <h2 className="font-display text-3xl md:text-5xl text-primary mt-2">Know what is included—and what is not.</h2>
        <Accordion type="multiple" defaultValue={["free-at-sea","service"]} className="mt-8 border-t border-border">
          <AccordionItem value="free-at-sea"><AccordionTrigger className="text-left text-lg text-primary">Free at Sea and shore excursion credit</AccordionTrigger><AccordionContent><div className="grid md:grid-cols-2 gap-6 leading-relaxed text-muted-foreground"><div><h3 className="font-semibold text-foreground">Standard Free at Sea</h3><p className="mt-2">Rough estimate for two adults on this 7-night sailing: <strong>{money(freeAtSeaStandardEstimate)}</strong> in package charges ({money(config.freeAtSeaStandardPerPersonPerDay)} per person per day). NCL currently describes beverage, specialty dining, Wi-Fi, and shore-excursion components, but the exact booking promotion must be verified before confirmation.</p><p className="mt-3"><strong className="text-foreground">Shore excursion credit is not a free excursion.</strong> If applicable, it is a $50 credit for Guest 1 on qualifying NCL-booked tours at each eligible port. Eligibility and application for this reservation remain subject to the final promotion.</p></div><div><h3 className="font-semibold text-foreground">Free at Sea Plus</h3><p className="mt-2">Rough estimate for two adults on this 7-night sailing: <strong>{money(freeAtSeaPlusEstimate)}</strong> ({money(config.freeAtSeaPlusPerPersonPerDay)} per person per day). NCL’s current program may add enhanced beverage choices, unlimited streaming Wi-Fi, specialty-dining discounts, and prepaid service charges. Pride of America beverage inclusions and booking eligibility must be checked specifically.</p><p className="mt-3 text-sm"><strong className="text-foreground">Is Plus worth it?</strong> If you drink premium liquor, use Starbucks daily, and need full internet access, Plus can be worth it. If you are happy with the standard beverage package, included dining, and basic Wi-Fi, the standard package may be sufficient.</p></div></div></AccordionContent></AccordionItem>
          <AccordionItem value="service"><AccordionTrigger className="text-left text-lg text-primary">Service charges and gratuities</AccordionTrigger><AccordionContent><div className="grid md:grid-cols-2 gap-5"><div className="bg-muted p-5 rounded-md"><h3 className="font-semibold">Can be prepaid</h3><p className="text-sm text-muted-foreground mt-3">Daily service charges are separate from Free at Sea package charges. Estimated rates for this sailing:</p><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li>Inside, Oceanview, Balcony: <strong>{money(20)} per person, per day</strong></li><li>Club Balcony Suite: <strong>{money(25)} per person, per day</strong></li><li>The Haven / Suite: <strong>{money(30)} per person, per day</strong></li></ul><p className="text-sm text-muted-foreground mt-4">Example for a Balcony stateroom, 7 nights, 2 adults: {money(20)} × 2 guests × 7 nights = <strong>{money(280)}</strong> total service charges.</p></div><div className="bg-muted p-5 rounded-md"><h3 className="font-semibold">May appear as an additional charge</h3><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li>Hawaii Beverage Package gratuities/service charges</li><li>Specialty dining gratuities/service charges</li><li>Other Free at Sea benefits and onboard purchases</li><li>Hawaii GET tax where applicable</li></ul></div></div></AccordionContent></AccordionItem>
          <AccordionItem value="excursions"><AccordionTrigger className="text-left text-lg text-primary">Sample excursion planning</AccordionTrigger><AccordionContent><p className="text-sm text-muted-foreground mb-4">Examples and price ranges are approximate planning guides—not confirmed booking prices.</p><div className="grid md:grid-cols-2 gap-4">{excursions.map((item) => <article key={item.port} className="border border-border rounded-md p-5"><h3 className="font-display text-xl text-primary flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" />{item.port}</h3><p className="text-sm mt-3"><strong>Examples:</strong> {item.examples}</p><p className="text-sm mt-2"><strong>Approximate range:</strong> {item.range}</p><p className="text-sm mt-2"><strong>Duration:</strong> {item.duration}</p><p className="text-sm text-muted-foreground mt-2">{item.experience}</p></article>)}</div></AccordionContent></AccordionItem>
          <AccordionItem value="benefits"><AccordionTrigger className="text-left text-lg text-primary">Group benefits</AccordionTrigger><AccordionContent><p className="text-muted-foreground">Onboard credit, prepaid service charges, excursion credit, dining, Wi-Fi, reduced deposits, cabin discounts, amenities, tour-conductor benefits, and any Crestwell group amenity will be confirmed with NCL Group Department.</p></AccordionContent></AccordionItem>
           <AccordionItem value="hotel"><AccordionTrigger className="text-left text-lg text-primary">Hotel payment and cancellation terms</AccordionTrigger><AccordionContent><div className="overflow-x-auto"><table className="min-w-[980px] w-full text-sm"><thead className="bg-muted"><tr>{["Hotel / room","Nightly","Payment total","Taxes / fees","Pay at property","Cancellation","Payment"].map((item) => <th key={item} className="p-3 text-left">{item}</th>)}</tr></thead><tbody>{config.hotels.flatMap((item) => item.rooms.map((hotelRoom) => <tr key={`${item.id}-${hotelRoom.id}`} className="border-t border-border"><td className="p-3"><strong>{item.name}</strong><br /><span className="text-muted-foreground">{hotelRoom.name}</span></td><td className="p-3">{money(hotelRoom.nightlyRate)}</td><td className="p-3">{money(hotelRoom.prepaidTotal ?? hotelRoom.nightlyRate * hotelRoom.nights)}</td><td className="p-3">{hotelRoom.taxesFeesLabel}</td><td className="p-3">{hotelRoom.knownPayAtProperty > 0 ? money(hotelRoom.knownPayAtProperty) : "—"}</td><td className="p-3">{hotelRoom.cancellationLabel}</td><td className="p-3">{hotelRoom.paymentLabel}</td></tr>))}</tbody></table></div></AccordionContent></AccordionItem>
        </Accordion>

        <div className="mt-14"><p className="section-kicker">Example vacation configurations</p><h3 className="font-display text-3xl text-primary mt-2">Flexibility, not fixed packages.</h3><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">{scenarioRows.map(([label,total]) => <div key={label} className="border border-border bg-card rounded-md p-5"><p className="font-semibold">{label}</p><p className="font-display text-2xl text-primary mt-3">{money(total)}</p><p className="text-xs text-muted-foreground mt-1">Known March 20 cabin + hotel costs only</p></div>)}</div></div>
      </section>

      <section id="submit" className="bg-primary text-primary-foreground scroll-mt-20">
        <div className="max-w-5xl mx-auto px-5 md:px-10 py-14 md:py-20">
          <p className="text-xs uppercase tracking-[0.18em] text-accent font-bold">Build your Hawaii vacation</p>
          <h2 className="font-display text-4xl md:text-5xl mt-2">Submit your selections to Crestwell.</h2>
          <p className="text-primary-foreground/75 mt-4 max-w-2xl">This is a request for advisor review—not a booking or payment authorization.</p>
          <div className="grid md:grid-cols-2 gap-5 mt-10">
            <Field label="Traveler name *"><Input required value={form.traveler_name} onChange={(e) => setField("traveler_name", e.target.value)} /></Field>
            <Field label="Second traveler name"><Input value={form.second_traveler_name} onChange={(e) => setField("second_traveler_name", e.target.value)} /></Field>
            <Field label="Email *"><Input type="email" required value={form.email} onChange={(e) => setField("email", e.target.value)} /></Field>
            <Field label="Phone"><Input type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></Field>
            <Field label="Party size"><select value={form.party_size} onChange={(e) => setField("party_size", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background text-foreground px-3"><option value="1">1 traveler</option><option value="2">2 travelers</option></select></Field>
            <div className="rounded-md border border-primary-foreground/20 p-4 text-sm"><p className="font-semibold text-accent">Your selection</p><p className="mt-2">{sailing?.label || "Choose a sailing"}</p><p>{cabin?.name || "Choose a cabin"}</p><p>{hotel && room ? `${hotel.name} · ${room.name}` : "Choose a hotel room"}</p></div>
            <Field label="Special requests"><Textarea value={form.special_requests} onChange={(e) => setField("special_requests", e.target.value)} rows={3} /></Field>
            <Field label="Accessibility requirements"><Textarea value={form.accessibility_requirements} onChange={(e) => setField("accessibility_requirements", e.target.value)} rows={3} /></Field>
            <div className="md:col-span-2"><Field label="Additional comments"><Textarea value={form.additional_comments} onChange={(e) => setField("additional_comments", e.target.value)} rows={3} /></Field></div>
          </div>

          <div className="bg-primary-foreground/10 border border-primary-foreground/20 rounded-md p-5 mt-8">
            <div className="flex gap-3 items-start"><Checkbox id="disclosure" checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} className="mt-1 border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground" /><Label htmlFor="disclosure" className="text-sm leading-relaxed text-primary-foreground cursor-pointer">I understand that prices and availability are subject to change until booked and confirmed. Hotel taxes, resort/destination fees, cruise taxes, port expenses, service charges, gratuities, optional upgrades, excursions, and other applicable charges are shown separately when not included. Final pricing will be confirmed before payment.</Label></div>
          </div>
          <p className="text-sm mt-5 text-primary-foreground/75">Your Crestwell Travel Services advisor will review the final booking details with you before the reservation is finalized.</p>
          <Button type="submit" size="lg" disabled={!canReview || !accepted || submitting} className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90 min-h-12 h-auto px-6 sm:px-8 py-3 text-sm sm:text-base whitespace-normal text-left">{submitting ? "Submitting…" : "Submit Your Hawaii Vacation Selections"}<ChevronRight className="ml-2 h-5 w-5 shrink-0" /></Button>
        </div>
      </section>
    </form>
  </main>;
}

function ChoiceSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <div><Label className="font-semibold">{label}</Label><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">{options.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></div>;
}

function CostLine({ label, value }: { label: string; value?: number }) {
  return <div className="flex justify-between gap-4 border-b border-border pb-3"><span className="text-muted-foreground">{label}</span><strong className="tabular-nums">{value === undefined ? "—" : money(value)}</strong></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="text-primary-foreground">{label}</Label>{children}</div>;
}