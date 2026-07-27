import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Hotel,
  Search,
  Star,
  MapPin,
  Loader2,
  BedDouble,
  DollarSign,
  Calendar,
  Users,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gift,
} from "lucide-react";
import { useHotelSearch, HotelResult, HotelRate } from "@/hooks/useHotelSearch";
import { HotelDestinationInput } from "@/components/trips/HotelDestinationInput";
import { AddToTripSelector } from "@/components/search/AddToTripSelector";
import { HotelBookingVoucher } from "@/components/hotels/HotelBookingVoucher";
import { format } from "date-fns";

function getStars(categoryName: string): number {
  const match = categoryName?.match(/(\d)/);
  return match ? parseInt(match[1]) : 0;
}

export default function HotelSearch() {
  const {
    hotels,
    loading,
    searchHotels,
    checkRate,
    checkingRate,
    checkedRate,
    confirmBooking,
    booking,
    lastBookingResult,
    getHotelDetails,
  } = useHotelSearch();
  const { user } = useAuth();

  const [destination, setDestination] = useState("");
  const [destinationValid, setDestinationValid] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);

  // Property name filter (client-side filter on results)
  const [nameFilter, setNameFilter] = useState("");

  // Rate check / booking dialog
  const [selectedRate, setSelectedRate] = useState<{
    hotel: HotelResult;
    rate: HotelRate;
    roomName: string;
  } | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [holderName, setHolderName] = useState("");
  const [holderSurname, setHolderSurname] = useState("");
  const [remark, setRemark] = useState("");

  // Voucher dialog
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherHotelDetails, setVoucherHotelDetails] = useState<any | null>(null);

  // Expanded hotels
  const [expandedHotels, setExpandedHotels] = useState<Set<number>>(new Set());

  const handleSearch = () => {
    const dest = destination.trim().toUpperCase();
    if (!dest || !destinationValid) {
      toast.error("Please select a destination from the dropdown suggestions.");
      return;
    }
    if (!checkIn || !checkOut) {
      toast.error("Please select check-in and check-out dates.");
      return;
    }
    if (checkOut <= checkIn) {
      toast.error("Check-out date must be after check-in date.");
      return;
    }
    searchHotels({
      checkIn,
      checkOut,
      destination: dest,
      occupancies: [{ rooms, adults, children }],
    });
  };

  /**
   * Certification 2.5: Only call CheckRate if rateType === "RECHECK".
   * For "BOOKABLE" rates, skip CheckRate entirely.
   */
  const handleSelectRate = async (hotel: HotelResult, rate: HotelRate, roomName: string) => {
    setSelectedRate({ hotel, rate, roomName });
    setBookingDialogOpen(true);

    if (rate.rateType === "RECHECK") {
      await checkRate([rate.rateKey]);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedRate || !holderName || !holderSurname) return;

    const paxes: { roomId: number; type: string; name: string; surname: string }[] = [];
    for (let r = 1; r <= (selectedRate.rate.rooms || 1); r++) {
      for (let a = 0; a < (selectedRate.rate.adults || 1); a++) {
        paxes.push({
          roomId: r,
          type: "AD",
          name: a === 0 ? holderName : `Guest ${a + 1}`,
          surname: holderSurname,
        });
      }
      for (let c = 0; c < (selectedRate.rate.children || 0); c++) {
        paxes.push({
          roomId: r,
          type: "CH",
          name: `Child ${c + 1}`,
          surname: holderSurname,
        });
      }
    }

    const result = await confirmBooking({
      holder: { name: holderName, surname: holderSurname },
      rooms: [{ rateKey: selectedRate.rate.rateKey, paxes }],
      remark: remark || undefined,
    });

    if (result && user) {
      // Cert 4.2 — fetch full hotel address & phone for the voucher
      try {
        const details = await getHotelDetails(selectedRate.hotel.code);
        setVoucherHotelDetails(details?.hotels?.[0] || null);
      } catch (e) {
        console.warn("[HotelSearch] hotel details fetch failed:", e);
        setVoucherHotelDetails(null);
      }

      // Phase 4: Persist Hotelbeds booking to bookings table + auto-create margin line
      const bk = result?.booking;
      const ref = bk?.reference || bk?.clientReference || `HB-${Date.now()}`;
      const netRate = parseFloat(selectedRate.rate.net || "0");
      const sellRate = parseFloat(selectedRate.rate.sellingRate || selectedRate.rate.net || "0");

      try {
        const { data: newBooking } = await (supabase as any)
          .from("bookings")
          .insert({
            user_id: user.id,
            confirmation_number: ref,
            status: "confirmed",
            gross_sales: sellRate,
            total_price: sellRate,
            supplier_payout: netRate,
            net_sales: sellRate - netRate,
            commissionable_amount: sellRate,
          })
          .select("id")
          .single();

        if (newBooking) {
          await (supabase as any).from("booking_margin_lines").insert({
            booking_id: newBooking.id,
            user_id: user.id,
            line_type: "hotel",
            description: `${selectedRate.hotel.name} — ${selectedRate.roomName}`,
            source: "hotelbeds",
            quantity: 1,
            unit_cost: netRate,
            unit_sell: sellRate,
            is_pass_through: false,
            sort_order: 0,
          });

          (supabase as any).rpc("calculate_booking_margin", {
            p_booking_id: newBooking.id,
            p_advisor_split: null,
            p_force_recalc: false,
          }).catch((e: any) => console.error("[HotelSearch] margin calc error:", e));
        }
      } catch (e) {
        console.error("[HotelSearch] Failed to persist booking:", e);
      }

      setBookingDialogOpen(false);
      setVoucherOpen(true);
    }
  };

  const toggleHotel = (code: number) => {
    setExpandedHotels((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Hotel className="h-6 w-6 text-primary" />
            Hotel Search
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Search and book hotels powered by HotelBeds
          </p>
        </div>

        {/* Search Form */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="space-y-2 lg:col-span-2">
                <Label>Destination</Label>
                <HotelDestinationInput
                  value={destination}
                  onChange={(code) => {
                    setDestination(code);
                    setDestinationValid(false); // reset until confirmed selection
                  }}
                  onSelect={(code) => {
                    setDestination(code);
                    setDestinationValid(true);
                  }}
                  placeholder="Search city or code..."
                />
              </div>
              <div className="space-y-2">
                <Label>Check-in</Label>
                <Input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Check-out</Label>
                <Input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Adults</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={adults}
                  onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rooms</Label>
                <Input
                  type="number"
                  min={1}
                  max={9}
                  value={rooms}
                  onChange={(e) => setRooms(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div className="space-y-2 w-24">
                <Label>Children</Label>
                <Input
                  type="number"
                  min={0}
                  max={4}
                  value={children}
                  onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex-1" />
              <Button
                onClick={handleSearch}
                disabled={loading || !destination || !checkIn || !checkOut}
                className="mt-6"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search Hotels
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Searching hotels...</span>
          </div>
        )}

        {!loading && hotels.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {hotels.length} Hotel{hotels.length !== 1 ? "s" : ""} Found
              </h2>
              <Badge variant="secondary">
                {checkIn} → {checkOut}
              </Badge>
            </div>

            <div className="max-w-sm">
              <Label htmlFor="hotel-name-filter" className="text-xs text-muted-foreground">
                Filter by property name
              </Label>
              <Input
                id="hotel-name-filter"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="e.g. Marriott, Hilton..."
                className="mt-1"
              />
            </div>

            {(() => {
              const q = nameFilter.trim().toLowerCase();
              const filtered = q
                ? hotels.filter((h) => h.name?.toLowerCase().includes(q))
                : hotels;
              if (filtered.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No hotels match "{nameFilter}".
                  </p>
                );
              }
              return filtered.map((hotel) => {
              const stars = getStars(hotel.categoryName);
              const expanded = expandedHotels.has(hotel.code);

              return (
                <Card key={hotel.code} className="overflow-hidden">
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleHotel(hotel.code)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {hotel.name}
                          <div className="flex gap-0.5">
                            {Array.from({ length: stars }).map((_, i) => (
                              <Star
                                key={i}
                                className="h-3.5 w-3.5 fill-warning text-warning"
                              />
                            ))}
                          </div>
                        </CardTitle>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {hotel.destinationName} · {hotel.zoneName}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {hotel.categoryName}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">From</p>
                          <p className="text-lg font-bold text-primary">
                            {hotel.currency} {hotel.minRate}
                          </p>
                        </div>
                        {expanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {expanded && (
                    <CardContent className="border-t pt-4 space-y-3">
                      {hotel.rooms.map((room) => (
                        <div key={room.code} className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <BedDouble className="h-4 w-4 text-muted-foreground" />
                            {room.name}
                          </h4>
                          <div className="grid gap-2">
                            {room.rates.map((rate, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-sm flex-wrap">
                                    <Badge variant="secondary" className="text-xs">
                                      {rate.boardName}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                      {rate.rooms} room{rate.rooms > 1 ? "s" : ""} · {rate.adults} adult{rate.adults > 1 ? "s" : ""}
                                      {rate.children > 0 && ` · ${rate.children} child${rate.children > 1 ? "ren" : ""}`}
                                    </span>
                                    {rate.rateType === "RECHECK" && (
                                      <Badge variant="outline" className="text-xs border-destructive/50 text-destructive">
                                        Rate check required
                                      </Badge>
                                    )}
                                    {rate.rateType === "BOOKABLE" && (
                                      <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                                        Instant book
                                      </Badge>
                                    )}
                                    {rate.packaging && (
                                      <Badge variant="outline" className="text-xs">
                                        Package only
                                      </Badge>
                                    )}
                                    {/* Exclusive Deal — certification 2.6 */}
                                    {(rate.rateClass === "NRF" ||
                                      rate.promotions?.some((p) =>
                                        /exclus|deal/i.test(p.name),
                                      )) && (
                                      <Badge className="text-xs bg-warning/90 hover:bg-warning text-white">
                                        Exclusive Deal
                                      </Badge>
                                    )}
                                  </div>
                                  {/* Promotions — certification 2.7 */}
                                  {rate.promotions && rate.promotions.length > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-primary">
                                      <Gift className="h-3 w-3" />
                                      {rate.promotions.map(p => p.name).join(", ")}
                                    </div>
                                  )}
                                  {/* Cancellation policies — certification 3.8 */}
                                  {rate.cancellationPolicies && rate.cancellationPolicies.length > 0 && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      Cancel by {format(new Date(rate.cancellationPolicies[0].from), "MMM d, yyyy HH:mm")} (destination time) — {hotel.currency} {rate.cancellationPolicies[0].amount} penalty
                                    </p>
                                  )}
                                  {/* Rate comments indicator — certification 3.9 */}
                                  {rate.rateCommentsId && (
                                    <p className="text-xs text-muted-foreground italic">
                                      ⓘ Rate comments apply — shown before confirmation
                                    </p>
                                  )}
                                  {rate.discount && parseFloat(rate.discount) > 0 && (
                                    <p className="text-xs text-primary font-medium">
                                      {rate.discountPCT}% discount — save {hotel.currency} {rate.discount}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    {/* Selling rate display — certification 3.12 */}
                                    {rate.sellingRate && rate.sellingRate !== rate.net && (
                                      <p className="text-xs text-muted-foreground">
                                        Selling: {hotel.currency} {rate.sellingRate}
                                      </p>
                                    )}
                                    <p className="text-base font-bold text-foreground">
                                      {hotel.currency} {rate.net}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">net rate</p>
                                    {rate.rsp && (
                                      <p className="text-xs font-semibold text-primary mt-1">
                                        RSP: {hotel.currency} {rate.rsp}
                                        <span className="text-[10px] text-muted-foreground ml-1">
                                          (+{rate.rspMarkupPct}%)
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <AddToTripSelector
                                      label="Add"
                                      items={[{
                                        day_number: 1,
                                        title: `${hotel.name} — ${room.name}`,
                                        description: `${rate.boardName} • ${rate.rooms} room${rate.rooms > 1 ? "s" : ""} • ${rate.adults} adult${rate.adults > 1 ? "s" : ""}${rate.children > 0 ? ` • ${rate.children} child${rate.children > 1 ? "ren" : ""}` : ""}`,
                                        category: "hotel",
                                        location: `${hotel.destinationName}, ${hotel.zoneName}`,
                                        notes: `Net rate: ${hotel.currency} ${rate.net}${rate.cancellationPolicies?.[0] ? ` • Cancel by ${format(new Date(rate.cancellationPolicies[0].from), "MMM d, yyyy")}` : ""}`,
                                      }]}
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => handleSelectRate(hotel, rate, room.name)}
                                      disabled={rate.packaging === true}
                                    >
                                      Book
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              );
              });
            })()}
          </div>
        )}

        {/* Booking Dialog */}
        <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Confirm Hotel Booking
              </DialogTitle>
            </DialogHeader>

            {selectedRate && (
              <div className="space-y-4">
                {/* Hotel summary */}
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="font-medium">{selectedRate.hotel.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRate.roomName}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">{selectedRate.rate.boardName}</Badge>
                    <span>{selectedRate.rate.rooms} room · {selectedRate.rate.adults} adults</span>
                  </div>
                </div>

                {/* Rate check status — only shown for RECHECK rates */}
                {selectedRate.rate.rateType === "RECHECK" ? (
                  checkingRate ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying latest rate...
                    </div>
                  ) : checkedRate ? (
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                      <p className="text-sm text-primary flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Rate verified — {selectedRate.hotel.currency} {selectedRate.rate.net}
                      </p>
                    </div>
                  ) : null
                ) : (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <p className="text-sm text-primary flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Instant booking — rate is confirmed
                    </p>
                  </div>
                )}

                {/* Rate comments — must be shown before confirmation (3.9) */}
                {selectedRate.rate.rateComments && (
                  <div className="rounded-lg border border-warning/20 bg-warning/10/50 dark:bg-warning/10 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Rate Comments</p>
                    <p className="text-sm text-foreground">{selectedRate.rate.rateComments}</p>
                  </div>
                )}

                {/* Cancellation policy — shown before confirmation (3.8) */}
                {selectedRate.rate.cancellationPolicies && selectedRate.rate.cancellationPolicies.length > 0 && (
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Cancellation Policy</p>
                    {selectedRate.rate.cancellationPolicies.map((cp, i) => (
                      <p key={i} className="text-sm text-foreground">
                        {selectedRate.hotel.currency} {cp.amount} penalty from{" "}
                        {format(new Date(cp.from), "MMM d, yyyy HH:mm")} (destination time)
                      </p>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Guest info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Holder First Name</Label>
                    <Input
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Holder Last Name</Label>
                    <Input
                      value={holderSurname}
                      onChange={(e) => setHolderSurname(e.target.value)}
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Booking Remarks (optional)</Label>
                  <Input
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Late check-in, extra pillows, etc."
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setBookingDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmBooking}
                disabled={
                  booking ||
                  !holderName ||
                  !holderSurname ||
                  (selectedRate?.rate.rateType === "RECHECK" && checkingRate)
                }
              >
                {booking ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Confirm Booking
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Voucher Dialog */}
        <Dialog open={voucherOpen} onOpenChange={setVoucherOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {lastBookingResult?.booking && (
              <HotelBookingVoucher
                booking={lastBookingResult.booking}
                hotelDetails={voucherHotelDetails}
                onClose={() => {
                  setVoucherOpen(false);
                  setSelectedRate(null);
                  setHolderName("");
                  setHolderSurname("");
                  setRemark("");
                  setVoucherHotelDetails(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
