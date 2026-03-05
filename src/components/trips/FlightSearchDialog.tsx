import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plane, Search, Loader2, Clock, ArrowRight, Users, Check, PenLine, Plus, Trash2,
} from "lucide-react";
import { useFlightSearch, type FlightOffer } from "@/hooks/useFlightSearch";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripName: string;
  destination?: string | null;
  departDate?: string | null;
  returnDate?: string | null;
  onAddFlightToItinerary: (data: any) => Promise<boolean>;
}

function formatDuration(iso: string) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}h` : "";
  const m = match[2] ? ` ${match[2]}m` : "";
  return `${h}${m}`.trim();
}

type Step = "search" | "results" | "manual";

export function FlightSearchDialog({
  open, onOpenChange, tripId, tripName,
  destination, departDate, returnDate,
  onAddFlightToItinerary,
}: Props) {
  const { offers, loading, searchFlights } = useFlightSearch();
  const [step, setStep] = useState<Step>("search");
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());

  // Search form
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [depDate, setDepDate] = useState(departDate || "");
  const [retDate, setRetDate] = useState(returnDate || "");
  const [cabinClass, setCabinClass] = useState("economy");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [tripType, setTripType] = useState<"roundtrip" | "oneway">("roundtrip");

  // Manual form
  const [manualForm, setManualForm] = useState({
    title: "", departure_city_code: "", arrival_city_code: "",
    flight_number: "", start_time: "", end_time: "",
    item_date: "", description: "", day_number: 1,
  });

  const generateFlightTitle = (form: typeof manualForm) => {
    const parts: string[] = [];
    if (form.flight_number) parts.push(form.flight_number.toUpperCase());
    if (form.departure_city_code && form.arrival_city_code) {
      parts.push(`${form.departure_city_code} → ${form.arrival_city_code}`);
    }
    return parts.join(": ") || "";
  };

  const updateManualField = (field: string, value: string) => {
    const updated = { ...manualForm, [field]: value };
    const autoTitle = generateFlightTitle(updated);
    if (!manualForm.title || manualForm.title === generateFlightTitle(manualForm)) {
      updated.title = autoTitle;
    }
    setManualForm(updated);
  };

  const handleSearch = () => {
    if (!origin || !dest || !depDate) return;
    const slices = [
      { origin: origin.toUpperCase(), destination: dest.toUpperCase(), departure_date: depDate },
    ];
    if (tripType === "roundtrip" && retDate) {
      slices.push({
        origin: dest.toUpperCase(),
        destination: origin.toUpperCase(),
        departure_date: retDate,
      });
    }
    const passengers = [
      ...Array(adults).fill({ type: "adult" as const }),
      ...Array(children).fill({ type: "child" as const, age: 10 }),
    ];
    searchFlights({ slices, passengers, cabin_class: cabinClass });
    setStep("results");
  };

  const toggleOffer = (id: string) => {
    setSelectedOffers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAddSelected = async () => {
    const selected = offers.filter(o => selectedOffers.has(o.id));
    let count = 0;
    for (const offer of selected) {
      for (const slice of offer.slices) {
        const seg = slice.segments[0];
        const lastSeg = slice.segments[slice.segments.length - 1];
        const success = await onAddFlightToItinerary({
          trip_id: tripId,
          day_number: 1,
          title: `${seg.operating_carrier.name} ${seg.operating_carrier_flight_number}`,
          description: `${slice.origin.city_name} → ${slice.destination.city_name} • ${formatDuration(slice.duration)}${slice.segments.length > 1 ? ` • ${slice.segments.length - 1} stop(s)` : " • Direct"} • $${parseFloat(offer.total_amount).toFixed(2)} ${offer.total_currency}`,
          category: "flight",
          location: `${slice.origin.iata_code} → ${slice.destination.iata_code}`,
          start_time: format(parseISO(seg.departing_at), "HH:mm"),
          end_time: format(parseISO(lastSeg.arriving_at), "HH:mm"),
          item_date: format(parseISO(seg.departing_at), "yyyy-MM-dd"),
          flight_number: seg.operating_carrier_flight_number,
          departure_city_code: slice.origin.iata_code,
          arrival_city_code: slice.destination.iata_code,
        });
        if (success) count++;
      }
    }
    if (count > 0) {
      toast.success(`Added ${count} flight(s) to itinerary`);
      setSelectedOffers(new Set());
      onOpenChange(false);
      setStep("search");
    }
  };

  const handleManualSubmit = async () => {
    if (!manualForm.title.trim()) return;
    const success = await onAddFlightToItinerary({
      trip_id: tripId,
      day_number: manualForm.day_number,
      title: manualForm.title,
      description: manualForm.description || undefined,
      category: "flight",
      start_time: manualForm.start_time || undefined,
      end_time: manualForm.end_time || undefined,
      item_date: manualForm.item_date || undefined,
      flight_number: manualForm.flight_number || undefined,
      departure_city_code: manualForm.departure_city_code || undefined,
      arrival_city_code: manualForm.arrival_city_code || undefined,
    });
    if (success) {
      toast.success("Flight added to itinerary");
      setManualForm({
        title: "", departure_city_code: "", arrival_city_code: "",
        flight_number: "", start_time: "", end_time: "",
        item_date: "", description: "", day_number: 1,
      });
      onOpenChange(false);
      setStep("search");
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setStep("search");
      setSelectedOffers(new Set());
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plane className="h-4 w-4 text-primary" />
            </div>
            {step === "search" && "Search Flights"}
            {step === "results" && "Flight Results"}
            {step === "manual" && "Add Flight Manually"}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              — {tripName}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* SEARCH STEP */}
        {step === "search" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Trip Type</Label>
                <Select value={tripType} onValueChange={(v: "roundtrip" | "oneway") => setTripType(v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roundtrip">Round Trip</SelectItem>
                    <SelectItem value="oneway">One Way</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Cabin Class</Label>
                <Select value={cabinClass} onValueChange={setCabinClass}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">Economy</SelectItem>
                    <SelectItem value="premium_economy">Premium Economy</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="first">First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Adults</Label>
                <Select value={String(adults)} onValueChange={(v) => setAdults(Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Children</Label>
                <Select value={String(children)} onValueChange={(v) => setChildren(Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">From (IATA Code)</Label>
                <Input
                  placeholder="e.g. JFK"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                  maxLength={3}
                  className="h-9 uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">To (IATA Code)</Label>
                <Input
                  placeholder="e.g. LAX"
                  value={dest}
                  onChange={(e) => setDest(e.target.value.toUpperCase())}
                  maxLength={3}
                  className="h-9 uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Departure Date</Label>
                <Input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} className="h-9" />
              </div>
              {tripType === "roundtrip" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Return Date</Label>
                  <Input type="date" value={retDate} onChange={(e) => setRetDate(e.target.value)} className="h-9" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1.5"
                onClick={() => setStep("manual")}
              >
                <PenLine className="h-3.5 w-3.5" />
                Add Manually Instead
              </Button>
              <Button
                onClick={handleSearch}
                disabled={loading || !origin || !dest || !depDate || (tripType === "roundtrip" && !retDate)}
                className="gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Searching..." : "Search Flights"}
              </Button>
            </div>
          </div>
        )}

        {/* RESULTS STEP */}
        {step === "results" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setStep("search")}>
                  ← Back to Search
                </Button>
                <span className="text-sm text-muted-foreground">
                  {origin} → {dest} • {depDate}
                </span>
              </div>
              {selectedOffers.size > 0 && (
                <Button onClick={handleAddSelected} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add {selectedOffers.size} to Itinerary
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Searching flights...</p>
              </div>
            ) : offers.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Plane className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No flights found</p>
                <p className="text-sm mt-1">Try adjusting your search criteria.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {offers.length} flight{offers.length !== 1 ? "s" : ""} found
                </p>
                {offers
                  .sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount))
                  .map((offer) => (
                    <FlightOfferCard
                      key={offer.id}
                      offer={offer}
                      isSelected={selectedOffers.has(offer.id)}
                      onToggle={() => toggleOffer(offer.id)}
                    />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* MANUAL STEP */}
        {step === "manual" && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("search")}>
              ← Back to Search
            </Button>
            <div>
              <Label>Flight Title *</Label>
              <Input
                value={manualForm.title}
                onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                placeholder="e.g., American Airlines AA 1234"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Flight #</Label>
                <Input
                  value={manualForm.flight_number}
                  onChange={(e) => updateManualField("flight_number", e.target.value)}
                  placeholder="AA 1234"
                />
              </div>
              <div>
                <Label>From</Label>
                <Input
                  value={manualForm.departure_city_code}
                  onChange={(e) => updateManualField("departure_city_code", e.target.value.toUpperCase())}
                  placeholder="JFK"
                  maxLength={4}
                  className="uppercase"
                />
              </div>
              <div>
                <Label>To</Label>
                <Input
                  value={manualForm.arrival_city_code}
                  onChange={(e) => updateManualField("arrival_city_code", e.target.value.toUpperCase())}
                  placeholder="LAX"
                  maxLength={4}
                  className="uppercase"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={manualForm.item_date}
                  onChange={(e) => setManualForm({ ...manualForm, item_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Depart Time</Label>
                <Input
                  type="time"
                  value={manualForm.start_time}
                  onChange={(e) => setManualForm({ ...manualForm, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>Arrive Time</Label>
                <Input
                  type="time"
                  value={manualForm.end_time}
                  onChange={(e) => setManualForm({ ...manualForm, end_time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={manualForm.description}
                onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                placeholder="Additional details"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("search")}>Cancel</Button>
              <Button onClick={handleManualSubmit} disabled={!manualForm.title.trim()}>
                Add to Itinerary
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FlightOfferCard({
  offer,
  isSelected,
  onToggle,
}: {
  offer: FlightOffer;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`p-4 rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/40 hover:shadow-sm"
      }`}
      onClick={onToggle}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 space-y-2">
          {offer.slices.map((slice, idx) => (
            <div key={slice.id}>
              {idx > 0 && <Separator className="my-2" />}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 min-w-[110px]">
                  {slice.segments[0]?.operating_carrier?.logo_symbol_url ? (
                    <img
                      src={slice.segments[0].operating_carrier.logo_symbol_url}
                      alt={slice.segments[0].operating_carrier.name}
                      className="h-5 w-5 rounded"
                    />
                  ) : (
                    <Plane className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground truncate">
                    {slice.segments[0]?.operating_carrier?.name}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="font-semibold text-sm">
                      {format(parseISO(slice.segments[0].departing_at), "HH:mm")}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {slice.origin.iata_code}
                    </p>
                  </div>
                  <div className="flex flex-col items-center px-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDuration(slice.duration)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <div className="h-px w-10 bg-border" />
                      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                    </div>
                    {slice.segments.length > 1 ? (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">
                        {slice.segments.length - 1} stop{slice.segments.length > 2 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-[9px] text-green-600 font-medium">Direct</span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-sm">
                      {format(parseISO(slice.segments[slice.segments.length - 1].arriving_at), "HH:mm")}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {slice.destination.iata_code}
                    </p>
                  </div>
                </div>

                {/* Per-slice flight numbers */}
                <div className="text-[10px] text-muted-foreground">
                  {slice.segments.map(s => `${s.operating_carrier.iata_code}${s.operating_carrier_flight_number}`).join(" / ")}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Price + selection */}
        <div className="flex flex-col items-end gap-1 min-w-[120px]">
          <p className="text-xl font-bold">
            ${parseFloat(offer.total_amount).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <span className="text-[10px] text-muted-foreground">{offer.total_currency} total</span>
          {offer.passengers.length > 1 && (
            <span className="text-[10px] text-muted-foreground">
              ${(parseFloat(offer.total_amount) / offer.passengers.length).toFixed(2)}/person
            </span>
          )}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Users className="h-2.5 w-2.5" />
            {offer.passengers.length} pax
          </div>
          <div className={`mt-1 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
          }`}>
            {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
          </div>
        </div>
      </div>
    </div>
  );
}
