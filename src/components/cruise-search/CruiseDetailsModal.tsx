import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Ship, Calendar, MapPin, Anchor, Clock, X, ExternalLink } from "lucide-react";
import { AddToTripSelector, type CruiseCabinChoice } from "@/components/search/AddToTripSelector";
import type { WidgetySailing } from "./types";
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
  defaultTripId?: string;
}

// CruiseFeed rows carry the full sailing record (itinerary, fare, booking
// link), so this modal renders entirely from the selected sailing — no
// supplier detail calls needed.
export function CruiseDetailsModal({
  sailing,
  open,
  onOpenChange,
  onSelectAlternateSailing,
  alternateSailings = [],
  priceCache = {},
  defaultTripId,
}: CruiseDetailsModalProps) {
  const [tab, setTab] = useState("summary");

  const itinerary = useMemo(
    () => (sailing ? ((sailing as any).itinerary || []) as {
      day_number: number;
      title: string;
      location?: string | null;
      description?: string | null;
    }[] : []),
    [sailing],
  );

  if (!sailing) return null;

  const fromPrice: number | null =
    typeof (sailing as any).price_amount === "number" ? (sailing as any).price_amount : null;
  const bookingUrl: string | null = (sailing as any).booking_url || null;
  const perNight = fromPrice && sailing.nights ? fromPrice / sailing.nights : null;
  const portStops = getPortPreview(sailing);
  const seaDays = itinerary.filter((d) => d.title === "At Sea").length;

  const fares: { cabin_class: string; price_amount: number | null; available: boolean }[] =
    Array.isArray((sailing as any).fares) ? (sailing as any).fares : [];
  const pricedFares = fares.filter((f) => f.available && typeof f.price_amount === "number");
  const taxes: number | null = (sailing as any).taxes_and_fees ?? null;
  const obc: number | null = (sailing as any).obc_amount ?? null;

  const cruiseCabinChoices: CruiseCabinChoice[] = pricedFares.length
    ? pricedFares.map((f) => ({
        category_name: f.cabin_class,
        description: [
          sailing.ship_title ? `Ship: ${sailing.ship_title}` : null,
          sailing.nights ? `${sailing.nights} nights` : null,
          taxes != null ? `Taxes & fees $${taxes.toLocaleString()}` : null,
        ].filter(Boolean).join(" • ") || null,
        price_per_person: f.price_amount as number,
        deposit_amount: 0,
        capacity: null,
      }))
    : fromPrice
    ? [{
        category_name: "Lead rate — best available cabin",
        description: [
          sailing.ship_title ? `Ship: ${sailing.ship_title}` : null,
          sailing.nights ? `${sailing.nights} nights` : null,
          "Cabin category confirmed at booking",
        ].filter(Boolean).join(" • ") || null,
        price_per_person: fromPrice,
        deposit_amount: 0,
        capacity: null,
      }]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0">
        {/* Top metadata bar */}
        <div className="px-6 py-3 border-b bg-muted/20 shrink-0">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-base font-medium text-primary flex items-center gap-2 flex-wrap">
              {sailing.nights ? <span>{sailing.nights} Nights</span> : null}
              {sailing.nights ? <span className="text-muted-foreground">|</span> : null}
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
              <TabsTrigger value="itinerary" disabled={!itinerary.length}>Itinerary</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              <TabsContent value="summary" className="mt-0">
                <div className="grid grid-cols-12 gap-6">
                  {/* Image — left */}
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
                          {sailing.nights ? `${sailing.nights} Night ` : ""}{sailing.name}
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
                    {sailing.date_from && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span className="text-foreground">
                          {formatShortDate(sailing.date_from)}
                          {sailing.date_to ? ` – ${formatShortDate(sailing.date_to)}` : ""}
                        </span>
                      </div>
                    )}
                    {sailing.starts_at?.name && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="text-foreground">{sailing.starts_at.name}</span>
                      </div>
                    )}
                    {sailing.nights ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span className="text-foreground">
                          {sailing.nights} Nights{seaDays ? ` • ${seaDays} sea day${seaDays === 1 ? "" : "s"}` : ""}
                        </span>
                      </div>
                    ) : null}
                    {portStops && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <Anchor className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="text-foreground leading-relaxed">{portStops}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground italic pt-2">
                      Ports of call may vary by departure date and are subject to weather and other conditions.
                    </p>
                  </div>

                  {/* From price — right */}
                  <div className="col-span-12 md:col-span-4 space-y-3">
                    <div className="border rounded-lg p-4 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Lead Fare</p>
                      {fromPrice != null ? (
                        <div className="space-y-1.5 text-sm">
                          <div className="flex items-center justify-between border-b py-1">
                            <span className="text-xs font-medium text-muted-foreground">FROM (PER PERSON)</span>
                            <span className="text-sm font-semibold text-primary">
                              {formatPrice(fromPrice)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b py-1">
                            <span className="text-xs font-medium text-muted-foreground">PER NIGHT</span>
                            <span className="text-sm font-semibold text-primary">
                              {perNight ? formatPrice(perNight) : "—"}
                            </span>
                          </div>
                          {fares.length > 0 && (
                            <div className="pt-2 space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">BY CABIN (PER PERSON)</p>
                              {fares.map((f, i) => (
                                <div key={i} className="flex items-center justify-between py-0.5">
                                  <span className="text-xs text-foreground">{f.cabin_class}</span>
                                  <span className="text-xs font-semibold text-primary">
                                    {f.available && typeof f.price_amount === "number" ? formatPrice(f.price_amount) : "Not available"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {taxes != null && (
                            <div className="flex items-center justify-between border-t pt-1">
                              <span className="text-xs text-muted-foreground">Taxes & fees</span>
                              <span className="text-xs text-foreground">{formatPrice(taxes)}</span>
                            </div>
                          )}
                          {obc != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Onboard credit</span>
                              <span className="text-xs text-foreground">{formatPrice(obc)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground py-3">
                          Pricing not published for this sailing. Request a quote from the supplier.
                        </p>
                      )}
                    </div>
                    {bookingUrl && (
                      <a
                        href={bookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full border rounded-md px-3 py-2 text-sm text-primary hover:bg-accent/50 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View live offer
                      </a>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Fare shown is a live feed estimate per person, double occupancy. Taxes, fees,
                      and promotions are confirmed by the cruise line at booking.
                    </p>
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

              <TabsContent value="itinerary" className="mt-0">
                {itinerary.length === 0 ? (
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
              {fromPrice != null && (
                <span className="text-primary font-medium">
                  From {formatPrice(fromPrice)} pp (double occupancy)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
              <AddToTripSelector
                label="Add to Trip"
                defaultTripId={defaultTripId}
                items={itinerary.map((item) => ({
                  day_number: item.day_number,
                  title: item.title,
                  description: item.description || undefined,
                  category: item.title === "At Sea" ? "cruise" : "port",
                  location: item.location || undefined,
                  notes: [
                    sailing.ship_title ? `Ship: ${sailing.ship_title}` : null,
                    fromPrice != null ? `Lead fare: ${formatPrice(fromPrice)} pp` : null,
                    (sailing as any).booking_url ? `Live offer: ${(sailing as any).booking_url}` : null,
                  ].filter(Boolean).join(" • ") || undefined,
                }))}
                cruiseOffer={{
                  totalAmount: fromPrice ? fromPrice * 2 : 0,
                  currency: (sailing as any).price_currency || "USD",
                  cruiseLineName: sailing.operator_title,
                  shipName: sailing.ship_title || null,
                  sailingName: sailing.name,
                  cabinDescription: fromPrice != null
                    ? `Lead rate — ${formatPrice(fromPrice)} pp (double occ.)`
                    : null,
                  holidayRef: sailing.holiday_ref || null,
                  dateRef: null,
                  departureDate: sailing.date_from || null,
                  returnDate: sailing.date_to || null,
                  destination: [sailing.starts_at?.name, sailing.ends_at?.name].filter(Boolean).join(" → ") || null,
                }}
                cruiseCabinChoices={cruiseCabinChoices}
              />
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
