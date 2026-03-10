import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plane, Search, Clock, ArrowRight, Users, Loader2 } from "lucide-react";
import { useFlightSearch, FlightOffer } from "@/hooks/useFlightSearch";
import { AddToTripSelector } from "@/components/search/AddToTripSelector";
import { format, parseISO } from "date-fns";

function formatDuration(iso: string) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}h` : "";
  const m = match[2] ? ` ${match[2]}m` : "";
  return `${h}${m}`.trim();
}

export default function FlightSearch() {
  const { offers, loading, searchFlights } = useFlightSearch();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [cabinClass, setCabinClass] = useState("economy");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [tripType, setTripType] = useState<"roundtrip" | "oneway">("roundtrip");
  const [selectedOffer, setSelectedOffer] = useState<FlightOffer | null>(null);

  const handleSearch = () => {
    const slices = [
      { origin: origin.toUpperCase(), destination: destination.toUpperCase(), departure_date: departDate },
    ];
    if (tripType === "roundtrip" && returnDate) {
      slices.push({
        origin: destination.toUpperCase(),
        destination: origin.toUpperCase(),
        departure_date: returnDate,
      });
    }

    const passengers = [
      ...Array(adults).fill({ type: "adult" as const }),
      ...Array(children).fill({ type: "child" as const, age: 10 }),
    ];

    searchFlights({ slices, passengers, cabin_class: cabinClass });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            Flight Search
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Search and compare flights powered by Duffel
          </p>
        </div>

        {/* Search Form */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Trip Type */}
              <div className="space-y-2">
                <Label>Trip Type</Label>
                <Select value={tripType} onValueChange={(v: "roundtrip" | "oneway") => setTripType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roundtrip">Round Trip</SelectItem>
                    <SelectItem value="oneway">One Way</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cabin Class */}
              <div className="space-y-2">
                <Label>Cabin Class</Label>
                <Select value={cabinClass} onValueChange={setCabinClass}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">Economy</SelectItem>
                    <SelectItem value="premium_economy">Premium Economy</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="first">First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Adults */}
              <div className="space-y-2">
                <Label>Adults</Label>
                <Select value={String(adults)} onValueChange={(v) => setAdults(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Children */}
              <div className="space-y-2">
                <Label>Children</Label>
                <Select value={String(children)} onValueChange={(v) => setChildren(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {/* Origin */}
              <div className="space-y-2">
                <Label>From (IATA Code)</Label>
                <Input
                  placeholder="e.g. JFK"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  maxLength={3}
                  className="uppercase"
                />
              </div>

              {/* Destination */}
              <div className="space-y-2">
                <Label>To (IATA Code)</Label>
                <Input
                  placeholder="e.g. LAX"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  maxLength={3}
                  className="uppercase"
                />
              </div>

              {/* Depart Date */}
              <div className="space-y-2">
                <Label>Departure Date</Label>
                <Input type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)} />
              </div>

              {/* Return Date */}
              {tripType === "roundtrip" && (
                <div className="space-y-2">
                  <Label>Return Date</Label>
                  <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSearch}
                disabled={loading || !origin || !destination || !departDate || (tripType === "roundtrip" && !returnDate)}
                className="gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Searching..." : "Search Flights"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {offers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                {offers.length} flight{offers.length !== 1 ? "s" : ""} found
              </h2>
              {selectedOffer && (
                <AddToTripSelector
                  label="Add to Trip"
                  items={selectedOffer.slices.map((slice, idx) => ({
                    day_number: idx + 1,
                    title: `${slice.segments[0]?.operating_carrier?.name || "Flight"} ${slice.segments[0]?.operating_carrier_flight_number || ""}: ${slice.origin.iata_code} → ${slice.destination.iata_code}`,
                    description: `${format(parseISO(slice.segments[0].departing_at), "MMM d, HH:mm")} – ${format(parseISO(slice.segments[slice.segments.length - 1].arriving_at), "HH:mm")} • ${formatDuration(slice.duration)}${slice.segments.length > 1 ? ` • ${slice.segments.length - 1} stop${slice.segments.length > 2 ? "s" : ""}` : " • Direct"}`,
                    category: "flight",
                    location: `${slice.origin.city_name} → ${slice.destination.city_name}`,
                    start_time: format(parseISO(slice.segments[0].departing_at), "HH:mm"),
                    end_time: format(parseISO(slice.segments[slice.segments.length - 1].arriving_at), "HH:mm"),
                    flight_number: `${slice.segments[0]?.operating_carrier?.iata_code || ""}${slice.segments[0]?.operating_carrier_flight_number || ""}`,
                    departure_city_code: slice.origin.iata_code,
                    arrival_city_code: slice.destination.iata_code,
                    notes: `Total: $${parseFloat(selectedOffer.total_amount).toFixed(2)} ${selectedOffer.total_currency}`,
                  }))}
                />
              )}
            </div>

            {offers
              .sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount))
              .map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  isSelected={selectedOffer?.id === offer.id}
                  onSelect={() => setSelectedOffer(offer)}
                />
              ))}
          </div>
        )}

        {!loading && offers.length === 0 && origin && destination && departDate && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Plane className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Search for flights to see results here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function OfferCard({
  offer,
  isSelected,
  onSelect,
}: {
  offer: FlightOffer;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-primary border-primary" : ""
      }`}
      onClick={onSelect}
    >
      <CardContent className="py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Slices */}
          <div className="flex-1 space-y-3">
            {offer.slices.map((slice, idx) => (
              <div key={slice.id}>
                {idx > 0 && <Separator className="my-2" />}
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Airline logo */}
                  <div className="flex items-center gap-2 min-w-[120px]">
                    {slice.segments[0]?.operating_carrier?.logo_symbol_url ? (
                      <img
                        src={slice.segments[0].operating_carrier.logo_symbol_url}
                        alt={slice.segments[0].operating_carrier.name}
                        className="h-6 w-6 rounded"
                      />
                    ) : (
                      <Plane className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground truncate">
                      {slice.segments[0]?.operating_carrier?.name}
                    </span>
                  </div>

                  {/* Times */}
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="font-semibold text-foreground">
                        {format(parseISO(slice.segments[0].departing_at), "HH:mm")}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {slice.origin.iata_code}
                      </p>
                    </div>

                    <div className="flex flex-col items-center px-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(slice.duration)}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="h-px w-12 bg-border" />
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                      {slice.segments.length > 1 && (
                        <Badge variant="secondary" className="text-[10px] mt-0.5">
                          {slice.segments.length - 1} stop{slice.segments.length > 2 ? "s" : ""}
                        </Badge>
                      )}
                      {slice.segments.length === 1 && (
                        <span className="text-[10px] text-success font-medium">Direct</span>
                      )}
                    </div>

                    <div className="text-center">
                      <p className="font-semibold text-foreground">
                        {format(
                          parseISO(slice.segments[slice.segments.length - 1].arriving_at),
                          "HH:mm"
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {slice.destination.iata_code}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Price & Passengers */}
          <div className="flex flex-col items-end gap-1 min-w-[120px]">
            <p className="text-2xl font-bold text-foreground">
              ${parseFloat(offer.total_amount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <span className="text-xs text-muted-foreground">{offer.total_currency}</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {offer.passengers.length} passenger{offer.passengers.length > 1 ? "s" : ""}
            </div>
            <Button size="sm" variant={isSelected ? "default" : "outline"} className="mt-1">
              {isSelected ? "Selected" : "Select"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
