import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plane, ArrowLeft, AlertTriangle, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { FlightOffer, OrderPassenger } from "@/hooks/useFlightSearch";

interface Props {
  offer: FlightOffer;
  loading: boolean;
  onBack: () => void;
  onConfirm: (passengers: OrderPassenger[], paymentType: "balance" | "arc_bsp_cash") => void;
}

function formatDuration(iso: string) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}h` : "";
  const m = match[2] ? ` ${match[2]}m` : "";
  return `${h}${m}`.trim();
}

interface PassengerForm {
  id: string;
  type: string;
  given_name: string;
  family_name: string;
  born_on: string;
  gender: "m" | "f" | "";
  title: string;
  email: string;
  phone_number: string;
  infant_passenger_id: string;
}

export function FlightBookingCheckout({ offer, loading, onBack, onConfirm }: Props) {
  const [passengers, setPassengers] = useState<PassengerForm[]>([]);
  const [paymentType, setPaymentType] = useState<"balance" | "arc_bsp_cash">("balance");

  // Initialize passenger forms from offer passenger IDs
  useEffect(() => {
    setPassengers(
      offer.passengers.map((p) => ({
        id: p.id,
        type: p.type,
        given_name: "",
        family_name: "",
        born_on: "",
        gender: "" as "m" | "f" | "",
        title: "",
        email: "",
        phone_number: "",
        infant_passenger_id: "",
      }))
    );
  }, [offer]);

  const updatePassenger = (index: number, field: keyof PassengerForm, value: string) => {
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const infantPassengers = passengers.filter((p) => p.type === "infant_without_seat");
  const adultPassengers = passengers.filter((p) => p.type === "adult");

  const isValid = passengers.every(
    (p) =>
      p.given_name.trim() &&
      p.family_name.trim() &&
      p.born_on &&
      p.gender &&
      p.title &&
      p.email.trim() &&
      p.phone_number.trim()
  ) && infantPassengers.every((inf) => inf.infant_passenger_id);

  const handleConfirm = () => {
    const mapped: OrderPassenger[] = passengers.map((p) => ({
      id: p.id,
      given_name: p.given_name.trim(),
      family_name: p.family_name.trim(),
      born_on: p.born_on,
      gender: p.gender as "m" | "f",
      title: p.title,
      email: p.email.trim(),
      phone_number: p.phone_number.trim(),
      ...(p.infant_passenger_id ? { infant_passenger_id: p.infant_passenger_id } : {}),
    }));
    onConfirm(mapped, paymentType);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h3 className="text-base font-semibold">Complete Booking</h3>
      </div>

      {/* Offer summary */}
      <Card className="bg-muted/30">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-1">
              {offer.slices.map((slice, idx) => (
                <div key={slice.id} className="flex items-center gap-2 text-sm">
                  {idx > 0 && <Separator className="my-1" />}
                  <Plane className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">
                    {slice.origin.iata_code}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">
                    {slice.destination.iata_code}
                  </span>
                  <span className="text-muted-foreground text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(slice.duration)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {format(parseISO(slice.segments[0].departing_at), "MMM d, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">
                ${parseFloat(offer.total_amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <span className="text-xs text-muted-foreground">{offer.total_currency}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Passenger details */}
      <div className="space-y-4">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          Passenger Details
          <Badge variant="secondary">{passengers.length} passenger{passengers.length !== 1 ? "s" : ""}</Badge>
        </h4>

        {passengers.map((pax, idx) => (
          <Card key={pax.id}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                Passenger {idx + 1}
                <Badge variant="outline" className="text-xs capitalize">
                  {pax.type.replace("_", " ")}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Title *</Label>
                  <Select value={pax.title} onValueChange={(v) => updatePassenger(idx, "title", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mr">Mr</SelectItem>
                      <SelectItem value="mrs">Mrs</SelectItem>
                      <SelectItem value="ms">Ms</SelectItem>
                      <SelectItem value="miss">Miss</SelectItem>
                      <SelectItem value="dr">Dr</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Given Name *</Label>
                  <Input
                    className="h-8 text-xs"
                    value={pax.given_name}
                    onChange={(e) => updatePassenger(idx, "given_name", e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Family Name *</Label>
                  <Input
                    className="h-8 text-xs"
                    value={pax.family_name}
                    onChange={(e) => updatePassenger(idx, "family_name", e.target.value)}
                    placeholder="Last name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Gender *</Label>
                  <Select value={pax.gender} onValueChange={(v) => updatePassenger(idx, "gender", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">Male</SelectItem>
                      <SelectItem value="f">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date of Birth *</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={pax.born_on}
                    onChange={(e) => updatePassenger(idx, "born_on", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email *</Label>
                  <Input
                    type="email"
                    className="h-8 text-xs"
                    value={pax.email}
                    onChange={(e) => updatePassenger(idx, "email", e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone *</Label>
                  <Input
                    className="h-8 text-xs"
                    value={pax.phone_number}
                    onChange={(e) => updatePassenger(idx, "phone_number", e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
              </div>

              {/* Infant-to-adult linking */}
              {pax.type === "adult" && infantPassengers.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground">
                    If this adult is responsible for an infant, assign them below.
                  </p>
                </div>
              )}

              {pax.type === "infant_without_seat" && (
                <div className="space-y-1">
                  <Label className="text-xs">Responsible Adult *</Label>
                  <Select
                    value={pax.infant_passenger_id}
                    onValueChange={(v) => updatePassenger(idx, "infant_passenger_id", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select responsible adult" />
                    </SelectTrigger>
                    <SelectContent>
                      {adultPassengers.map((adult, aIdx) => (
                        <SelectItem key={adult.id} value={adult.id}>
                          {adult.given_name || adult.family_name
                            ? `${adult.given_name} ${adult.family_name}`.trim()
                            : `Adult ${passengers.indexOf(adult) + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Type */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Select value={paymentType} onValueChange={(v: "balance" | "arc_bsp_cash") => setPaymentType(v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="balance">Duffel Balance</SelectItem>
              <SelectItem value="arc_bsp_cash">ARC/BSP Cash</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            {paymentType === "balance"
              ? "Payment will be charged to your Duffel balance."
              : "For IATA-registered agents using their own airline relationships."}
          </p>
        </CardContent>
      </Card>

      {/* Legal notice */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-200">
          By confirming this booking, you agree that passenger details are accurate and acknowledge
          the airline's terms, conditions, and fare rules. Passenger data will be shared with the
          operating airline(s) to fulfill the booking.
        </p>
      </div>

      {/* Confirm button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onBack}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          disabled={!isValid || loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {loading ? "Booking..." : `Confirm Booking — $${parseFloat(offer.total_amount).toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
