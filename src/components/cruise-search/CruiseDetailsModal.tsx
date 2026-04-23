import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Ship, Calendar, MapPin, DollarSign, ChevronRight } from "lucide-react";
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
}

export function CruiseDetailsModal({
  sailing,
  open,
  onOpenChange,
  dateFrom,
  dateTo,
}: CruiseDetailsModalProps) {
  const [tab, setTab] = useState("overview");
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
    setTab("overview");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="relative h-44 bg-gradient-to-br from-primary/20 to-primary/5 shrink-0">
          {sailing.image_url ? (
            <img src={sailing.image_url} alt={sailing.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Ship className="h-20 w-20 text-primary/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              {sailing.operator_title}
            </p>
            <DialogHeader>
              <DialogTitle className="text-xl">{sailing.name}</DialogTitle>
            </DialogHeader>
            {sailing.ship_title && (
              <p className="text-sm text-muted-foreground italic">{sailing.ship_title}</p>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 border-b">
            <TabsList className="bg-transparent h-11">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="dates">Sailing Dates</TabsTrigger>
              <TabsTrigger value="itinerary" disabled={!selectedDate}>Itinerary</TabsTrigger>
              <TabsTrigger value="pricing" disabled={!selectedDate}>Pricing</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              <TabsContent value="overview" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {sailing.date_from && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {formatShortDate(sailing.date_from)}
                        {sailing.date_to && ` – ${formatShortDate(sailing.date_to)}`}
                      </span>
                    </div>
                  )}
                  {sailing.nights && (
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4 text-muted-foreground" />
                      <span>{sailing.nights} nights</span>
                    </div>
                  )}
                  {getPortPreview(sailing) && (
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{getPortPreview(sailing)}</span>
                    </div>
                  )}
                </div>
                {sailing.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {sailing.description}
                  </p>
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
                  <div className="space-y-2">
                    {dates.map((d) => {
                      const prices = d.headline_prices?.cruise?.double;
                      const lowest = prices
                        ? Math.min(
                            ...[prices.from_inside, prices.from_outside, prices.from_balcony, prices.from_suite]
                              .map((p) => parseFloat(p || "0"))
                              .filter((p) => p > 0),
                          )
                        : null;
                      return (
                        <button
                          key={d.date_ref}
                          onClick={() => loadItinerary(d)}
                          className="w-full text-left p-3 border rounded-lg hover:bg-accent/50 transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">
                                {formatShortDate(d.date_from)} – {formatShortDate(d.date_to)}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                                {d.ship_title && <span>🚢 {d.ship_title}</span>}
                                {d.starts_at && (
                                  <span>{d.starts_at.name} → {d.ends_at?.name || ""}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {lowest && lowest < Infinity && (
                                <span className="text-sm font-semibold text-primary">
                                  {formatPrice(lowest)} pp
                                </span>
                              )}
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
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

          {/* Footer */}
          <div className="border-t p-4 flex items-center justify-between gap-3 flex-wrap bg-muted/20">
            <div className="text-sm">
              {selectedCabin && (
                <span className="text-primary font-medium">
                  {selectedCabin.room_type} • {formatPrice(parseFloat(selectedCabin.cabin.double_price_pp))} pp
                </span>
              )}
            </div>
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
        </Tabs>
      </DialogContent>
    </Dialog>
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