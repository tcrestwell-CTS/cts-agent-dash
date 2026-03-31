import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, Download, Hotel, Phone, MapPin, Calendar, Users, FileText } from "lucide-react";
import { format } from "date-fns";
import type { HotelBookingResult } from "@/hooks/useHotelSearch";

interface HotelBookingVoucherProps {
  booking: NonNullable<HotelBookingResult["booking"]>;
  agencyName?: string;
  onClose?: () => void;
}

export function HotelBookingVoucher({ booking, agencyName = "Crestwell Travel Services", onClose }: HotelBookingVoucherProps) {
  const hotel = booking.hotel;
  const supplier = hotel?.supplier;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto print:max-w-none">
      {/* Action buttons — hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Booking Voucher
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <Card className="print:shadow-none print:border-2">
        <CardHeader className="bg-primary/5 print:bg-white">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{agencyName}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Hotel Booking Confirmation</p>
            </div>
            <Badge variant="default" className="text-sm">
              {booking.status === "CONFIRMED" ? "Confirmed" : booking.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Booking Reference — mandatory (4.4) */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Hotelbeds Reference</p>
              <p className="text-lg font-bold text-foreground">{booking.reference}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Agency Reference</p>
              <p className="text-lg font-bold text-foreground">{booking.clientReference || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Booking Date</p>
              <p className="text-sm text-foreground">
                {booking.creationDate
                  ? format(new Date(booking.creationDate), "MMMM d, yyyy")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Status</p>
              <p className="text-sm text-foreground">{booking.status}</p>
            </div>
          </div>

          <Separator />

          {/* Hotel Info — mandatory: name, address (4.2) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Hotel className="h-4 w-4" /> Hotel Information
            </h3>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-base font-semibold text-foreground">{hotel.name}</p>
              {hotel.categoryName && (
                <p className="text-sm text-muted-foreground">Category: {hotel.categoryName}</p>
              )}
              {hotel.destinationName && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {hotel.destinationName}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Stay Dates — mandatory (4.4) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Stay Details
            </h3>
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
              <div>
                <p className="text-xs text-muted-foreground">Check-in</p>
                <p className="text-sm font-medium text-foreground">
                  {hotel.checkIn
                    ? format(new Date(hotel.checkIn), "EEEE, MMMM d, yyyy")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Check-out</p>
                <p className="text-sm font-medium text-foreground">
                  {hotel.checkOut
                    ? format(new Date(hotel.checkOut), "EEEE, MMMM d, yyyy")
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Passenger Info — mandatory: holder name, pax per room (4.3) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Users className="h-4 w-4" /> Guest Information
            </h3>
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Lead Guest / Holder</p>
                <p className="text-sm font-semibold text-foreground">
                  {booking.holder.name} {booking.holder.surname}
                </p>
              </div>

              {hotel.rooms?.map((room, idx) => (
                <div key={idx} className="border-t pt-2 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Room {idx + 1}: {room.name}
                  </p>
                  {room.paxes?.map((pax, pi) => (
                    <p key={pi} className="text-sm text-muted-foreground ml-4">
                      {pax.name} {pax.surname}
                      {pax.type === "CH" && pax.age != null && ` (Child, age ${pax.age})`}
                    </p>
                  ))}
                  {/* Room type & board — mandatory (4.4) */}
                  {room.rates?.[0] && (
                    <div className="flex gap-2 ml-4 mt-1">
                      <Badge variant="secondary" className="text-xs">{room.rates[0].boardName}</Badge>
                      {room.rates[0].rateComments && (
                        <Badge variant="outline" className="text-xs">Has rate comments</Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rate Comments — mandatory if applicable (4.4) */}
          {hotel.rooms?.some(r => r.rates?.some((rt: any) => rt.rateComments)) && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Rate Comments</h3>
                <div className="rounded-lg border p-4 bg-amber-50/50 dark:bg-amber-950/10 space-y-2">
                  {hotel.rooms?.map((room) =>
                    room.rates?.filter((rt: any) => rt.rateComments).map((rt: any, i: number) => (
                      <p key={i} className="text-sm text-foreground">{rt.rateComments}</p>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Remarks */}
          {booking.remark && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Booking Remarks</h3>
                <p className="text-sm text-foreground rounded-lg border p-4">{booking.remark}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Payment Information — mandatory (4.5) */}
          <div className="rounded-lg border p-4 bg-muted/30 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Payment Information</p>
            <p>
              Payable through {supplier?.name || "Hotelbeds"}, acting as agent for the service operating company,
              details of which can be provided upon request.
              {supplier?.vatNumber && ` VAT: ${supplier.vatNumber}`}
              {" "}Reference: {booking.reference}
            </p>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>This voucher was generated by {agencyName}.</p>
            <p>Please present this voucher at check-in.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
