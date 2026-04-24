import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Ship, Calendar, MapPin, DollarSign, Anchor, Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddToTripSelector } from "@/components/search/AddToTripSelector";
import type {
  WidgetySailing,
  WidgetyDate,
  WidgetyItineraryItem,
  WidgetyCabinPrice,
  WidgetyPricingDeal,
} from "./types";
import { formatShortDate, formatPrice, getPortPreview } from "./utils";

interface CruiseDetailsModalProps {
  sailing: WidgetySailing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateFrom?: string;
  dateTo?: string;
  onSelectAlternateSailing?: (sailing: WidgetySailing) => void;
  alternateSailings?: WidgetySailing[];
  priceCache?: Record<string, number | null>;
}

export function CruiseDetailsModal({
  sailing,
  open,
  onOpenChange,
  dateFrom,
  dateTo,
  onSelectAlternateSailing,
  alternateSailings = [],
  priceCache = {},
}: CruiseDetailsModalProps) {
  const [tab, setTab] = useState("summary");
  const [datesLoading, setDatesLoading] = useState(false);
  const [dates, setDates] = useState<WidgetyDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<WidgetyDate | null>(null);
  const [itinerary, setItinerary] = useState<WidgetyItineraryItem[]>([]);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [selectedCabin, setSelectedCabin] = useState<{
    deal_name: string;
    cabin: WidgetyCabinPrice;
    room_type: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !sailing) return;
    setTab("summary");
    setSelectedDate(null);
    setSelectedCabin(null);
    setItinerary([]);
    setDates([]);

    const loadDates = async () => {
      setDatesLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("widgety-cruise", {
          body: {
            action: "holiday",
            holiday_ref: sailing.holiday_ref,
            market: "us",
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
          },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        const allDates: WidgetyDate[] = [];
        for (const season of data.operating_seasons || []) {
          for (const d of season.dates || []) allDates.push(d);
        }
        setDates(allDates);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load sailing dates");
      } finally {
        setDatesLoading(false);
      }
    };
    loadDates();
  }, [open, sailing, dateFrom, dateTo]);

  const loadItinerary = async (date: WidgetyDate) => {
    setSelectedDate(date);
    setSelectedCabin(null);
    setItineraryLoading(true);
    setItinerary([]);
    try {
      const { data, error } = await supabase.functions.invoke("widgety-cruise", {
        body: {
          action: "itinerary",
          date_ref: date.date_ref,
          itinerary_code: date.itinerary_code,
          market: "us",
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setItinerary(data.items || []);
      setTab("itinerary");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load itinerary");
    } finally {
      setItineraryLoading(false);
    }
  };

  if (!sailing) return null;

  // Compute lowest rates per room type from first available date with pricing
  const lowestRates = (() => {
    const dateWithPricing = dates.find(
      (d) => d.headline_prices?.cruise?.double || d.pricing?.length,
    );
    if (!dateWithPricing) return null;
    const dbl = dateWithPricing.headline_prices?.cruise?.double;
    const parse = (v?: string) => {
      const n = parseFloat(v || "0");
      return n > 0 ? n : null;
    };
    return {
      inside: parse(dbl?.from_inside),
      outside: parse(dbl?.from_outside),
      balcony: parse(dbl?.from_balcony),
      suite: parse(dbl?.from_suite),
    };
  })();

  const fromPrice = (() => {
    if (!lowestRates) return null;
    const vals = Object.values(lowestRates).filter((v): v is number => v != null);
    return vals.length ? Math.min(...vals) : null;
  })();

  const perNight = fromPrice && sailing.nights ? fromPrice / sailing.nights : null;
  const portStops = getPortPreview(sailing);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0">
        {/* Top metadata bar — matches reference: nights | region | line | ship | name */}
        <div className="px-6 py-3 border-b bg-muted/20 shrink-0">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-base font-medium text-primary flex items-center gap-2 flex-wrap">
              {sailing.nights && <span>{sailing.nights} Nights</span>}
              {sailing.nights && <span className="text-muted-foreground">|</span>}
              <span>{sailing.operator_title}</span>
              {sailing.ship_title && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <span>{sailing.ship_title}</span>
                </>
              )}
              <span className="text-muted-foreground">|</span>
              <span className="text-foreground">{sailing.name}</span>
            </DialogTitle>
          </DialogHeader>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 border-b">
            <TabsList className="bg-transparent h-11">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="dates">Sailing Dates</TabsTrigger>
              <TabsTrigger value="itinerary" disabled={!selectedDate}>Itinerary</TabsTrigger>
              <TabsTrigger value="pricing" disabled={!selectedDate}>Pricing</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              <TabsContent value="summary" className="mt-0">
                <div className="grid grid-cols-12 gap-6">
                  {/* Map / Image — left */}
                  <div className="col-span-12 md:col-span-4">
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-muted/30">
                      {sailing.image_url ? (
                        <img
                          src={sailing.image_url}
                          alt={sailing.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Ship className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/80 to-transparent p-3">
                        <p className="text-xs font-medium text-background/95">
                          {sailing.nights} Night {sailing.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cruise meta — middle */}
                  <div className="col-span-12 md:col-span-4 space-y-3 text-sm">
                    <p className="text-base font-semibold text-primary">{sailing.operator_title}</p>
                    {sailing.ship_title && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Ship className="h-4 w-4 shrink-0" />
                        <span className="text-foreground">{sailing.ship_title}</span>
                      </div>
                    )}
                    {sailing.starts_at?.name && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="text-foreground">{sailing.starts_at.name}</span>
                      </div>
                    )}
                    {sailing.nights && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span className="text-foreground">{sailing.nights} Nights</span>
                      </div>
                    )}
                    {portStops && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <Anchor className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="text-foreground leading-relaxed">{portStops}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground italic pt-2">
                      Ports of Call may vary by departure date and subject to weather and other conditions.
                    </p>
                  </div>

                  {/* Lowest rate table + From price — right */}
                  <div className="col-span-12 md:col-span-4 space-y-3">
                    <div className="border rounded-lg p-4 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Lowest Rate</p>
                      {datesLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : lowestRates ? (
                        <div className="space-y-1.5 text-sm">
                          <RateRow label="INSIDE" value={lowestRates.inside} />
                          <RateRow label="OUTSIDE" value={lowestRates.outside} />
                          <RateRow label="BALCONY" value={lowestRates.balcony} />
                          <RateRow label="SUITE" value={lowestRates.suite} />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground py-3">
                          Pricing not yet available. Check Sailing Dates tab.
                        </p>
                      )}
                    </div>
                    {fromPrice && (
                      <div className="text-right space-y-0.5">
                        <p className="text-xs text-muted-foreground">From</p>
                        <p className="text-2xl font-bold text-primary">{formatPrice(fromPrice)}</p>
                        {perNight && (
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(perNight)}/ night(s)
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">Includes taxes and fees</p>
                      </div>
                    )}
                  </div>
                </div>

                {sailing.description && (
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {sailing.description}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="dates" className="mt-0">
                {datesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : dates.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    No sailing dates available.
                  </p>
                ) : (
                  <SailingDateCalendar dates={dates} onSelect={loadItinerary} selectedRef={selectedDate?.date_ref} />
                )}
              </TabsContent>

              <TabsContent value="itinerary" className="mt-0">
                {itineraryLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : itinerary.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    No itinerary data for this sailing.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {itinerary.map((item, idx) => (
                      <div key={idx} className="flex gap-3 py-2 border-b last:border-0">
                        <span className="text-xs font-mono text-muted-foreground w-10 shrink-0 pt-0.5">
                          D{item.day_number}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{item.title}</p>
                          {item.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {item.location}
                            </p>
                          )}
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pricing" className="mt-0">
                {!selectedDate?.pricing?.length ? (
                  <p className="text-center text-muted-foreground py-12">
                    No detailed cabin pricing available.
                  </p>
                ) : (
                  <PricingTable
                    deals={selectedDate.pricing}
                    selectedCabin={selectedCabin}
                    onSelect={setSelectedCabin}
                  />
                )}
              </TabsContent>
            </div>
          </ScrollArea>

          {/* Alternate sailings strip + footer */}
          {alternateSailings.length > 0 && (
            <div className="border-t bg-muted/20 px-4 py-3 shrink-0">
              <div className="flex items-center gap-3 overflow-x-auto">
                {alternateSailings.slice(0, 6).map((alt) => {
                  const altPrice = priceCache[alt.holiday_ref];
                  return (
                    <button
                      key={alt.holiday_ref}
                      onClick={() => onSelectAlternateSailing?.(alt)}
                      className="group relative shrink-0 text-left bg-card border rounded-md px-3 py-2 hover:border-primary transition-colors min-w-52"
                    >
                      <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-foreground/80 text-background flex items-center justify-center">
                        <X className="h-2.5 w-2.5" />
                      </span>
                      <p className="text-xs font-medium truncate">
                        {alt.operator_title}: {alt.ship_title || alt.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {alt.date_from ? formatShortDate(alt.date_from) : ""}
                      </p>
                      {altPrice != null && (
                        <p className="text-sm font-semibold text-primary mt-0.5">
                          {formatPrice(altPrice)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t p-4 flex items-center justify-between gap-3 flex-wrap bg-card shrink-0">
            <div className="text-sm">
              {selectedCabin && (
                <span className="text-primary font-medium">
                  {selectedCabin.room_type} • {formatPrice(parseFloat(selectedCabin.cabin.double_price_pp))} pp
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
              <AddToTripSelector
              label="Add to Trip"
              items={(itinerary.length ? itinerary : []).map((item) => ({
                day_number: item.day_number,
                title: item.title,
                description: item.description || undefined,
                category: item.category || "cruise",
                location: item.location || undefined,
                start_time: item.start_time || undefined,
                end_time: item.end_time || undefined,
                notes: [
                  item.notes,
                  selectedCabin
                    ? `Cabin: ${selectedCabin.room_type} ${selectedCabin.cabin.grade_code} — ${formatPrice(parseFloat(selectedCabin.cabin.double_price_pp))} pp`
                    : null,
                  sailing.ship_title ? `Ship: ${sailing.ship_title}` : null,
                ].filter(Boolean).join(" • ") || undefined,
              }))}
              disabled={itinerary.length === 0}
              />
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function RateRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between border-b last:border-0 py-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${value ? "text-primary" : "text-muted-foreground"}`}>
        {value ? formatPrice(value) : "—"}
      </span>
    </div>
  );
}

function SailingDateCalendar({
  dates,
  onSelect,
  selectedRef,
}: {
  dates: WidgetyDate[];
  onSelect: (d: WidgetyDate) => void;
  selectedRef?: string;
}) {
  // Map "YYYY-MM-DD" → WidgetyDate (first sailing wins for that day)
  const dateMap = new Map<string, WidgetyDate>();
  for (const d of dates) {
    if (!d.date_from) continue;
    const key = d.date_from.slice(0, 10);
    if (!dateMap.has(key)) dateMap.set(key, d);
  }

  // Group sailings by year-month so we render one mini-calendar per active month
  const monthKeys = Array.from(
    new Set(Array.from(dateMap.keys()).map((k) => k.slice(0, 7))),
  ).sort();

  if (monthKeys.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">No sailing dates available.</p>
    );
  }

  const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {monthKeys.map((mk) => {
        const [yearStr, monthStr] = mk.split("-");
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        const first = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startWeekday = first.getDay();
        const monthLabel = first.toLocaleDateString("en-US", { month: "long" });

        const cells: (number | null)[] = [];
        for (let i = 0; i < startWeekday; i++) cells.push(null);
        for (let day = 1; day <= daysInMonth; day++) cells.push(day);
        while (cells.length % 7 !== 0) cells.push(null);

        return (
          <div key={mk} className="border rounded-lg overflow-hidden bg-card">
            <div className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold tracking-wide">{monthLabel}</span>
              <span className="text-sm font-semibold">{year}</span>
            </div>
            <div className="grid grid-cols-7 gap-y-1 px-3 py-3">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={`wd-${i}`}
                  className="text-[10px] uppercase font-medium text-muted-foreground text-center pb-1"
                >
                  {w}
                </div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;
                const key = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
                const sailing = dateMap.get(key);
                const isSelected = sailing && sailing.date_ref === selectedRef;
                if (!sailing) {
                  return (
                    <div
                      key={key}
                      className="h-8 flex items-center justify-center text-xs text-muted-foreground/40"
                    >
                      {day}
                    </div>
                  );
                }
                return (
                  <button
                    key={key}
                    onClick={() => onSelect(sailing)}
                    title={`Depart ${formatShortDate(sailing.date_from)} • ${sailing.ship_title || ""}`}
                    className={`h-8 flex items-center justify-center text-xs font-semibold rounded-md transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                        : "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="md:col-span-2 text-xs text-muted-foreground text-center pt-1">
        Click a highlighted date to load its itinerary and pricing.
      </p>
    </div>
  );
}

function PricingTable({
  deals,
  selectedCabin,
  onSelect,
}: {
  deals: WidgetyPricingDeal[];
  selectedCabin: { deal_name: string; cabin: WidgetyCabinPrice; room_type: string } | null;
  onSelect: (sel: { deal_name: string; cabin: WidgetyCabinPrice; room_type: string }) => void;
}) {
  const roomOrder = ["Inside", "Outside", "Balcony", "Suite", "Other"];
  return (
    <div className="space-y-5">
      {deals.map((deal, di) => {
        const grouped: Record<string, WidgetyCabinPrice[]> = {};
        for (const p of deal.prices) {
          const pp = parseFloat(p.double_price_pp || "0");
          if (pp <= 0) continue;
          const type = p.room_type || "Other";
          if (!grouped[type]) grouped[type] = [];
          grouped[type].push(p);
        }
        for (const type of Object.keys(grouped)) {
          grouped[type].sort((a, b) => parseFloat(a.double_price_pp) - parseFloat(b.double_price_pp));
        }
        const sortedTypes = Object.keys(grouped).sort(
          (a, b) =>
            (roomOrder.indexOf(a) === -1 ? 99 : roomOrder.indexOf(a)) -
            (roomOrder.indexOf(b) === -1 ? 99 : roomOrder.indexOf(b)),
        );
        return (
          <div key={di}>
            {deal.name && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {deal.name}
              </p>
            )}
            {sortedTypes.map((roomType) => (
              <div key={roomType} className="mb-3">
                <p className="text-sm font-medium mb-1">{roomType}</p>
                <div className="space-y-1">
                  {grouped[roomType].map((cabin, ci) => {
                    const dbl = parseFloat(cabin.double_price_pp);
                    const fees = parseFloat(cabin.non_comm_charges || "0");
                    const isSelected =
                      selectedCabin?.cabin.grade_code === cabin.grade_code &&
                      selectedCabin?.room_type === roomType;
                    return (
                      <button
                        key={ci}
                        onClick={() => onSelect({ deal_name: deal.name || "", cabin, room_type: roomType })}
                        className={`w-full flex items-center justify-between py-2 px-3 rounded border text-sm transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-muted-foreground">{cabin.grade_code}</span>
                          <span className="truncate">{cabin.grade_name}</span>
                          {cabin.availability && cabin.availability !== "available" && (
                            <Badge variant="secondary" className="text-xs">{cabin.availability}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-semibold text-primary">
                            <DollarSign className="h-3 w-3 inline -mt-0.5" />
                            {formatPrice(dbl)} pp
                          </span>
                          {fees > 0 && (
                            <span className="text-muted-foreground text-xs">
                              +{formatPrice(fees)} fees
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}