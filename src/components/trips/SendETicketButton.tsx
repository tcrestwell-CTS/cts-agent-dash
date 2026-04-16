import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Ticket, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendETicketButtonProps {
  bookingId: string;
  tripId: string;
  confirmationNumber: string;
}

export function SendETicketButton({ bookingId, tripId, confirmationNumber }: SendETicketButtonProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      // Get flight order data with e-ticket info
      const { data: flightOrder, error: foErr } = await supabase
        .from("flight_orders")
        .select("*")
        .eq("trip_id", tripId)
        .eq("booking_reference", confirmationNumber)
        .maybeSingle();

      if (foErr) throw foErr;

      let resolvedFlightOrder = flightOrder;

      // If no local record, refetch from Duffel API
      if (!resolvedFlightOrder) {
        toast.info("Fetching e-ticket from Duffel...");
        const { data: refetchData, error: refetchErr } = await supabase.functions.invoke("duffel-flights", {
          body: {
            action: "refetch_order",
            booking_reference: confirmationNumber,
            booking_id: bookingId,
            trip_id: tripId,
          },
        });
        if (refetchErr) throw refetchErr;
        if (!refetchData?.success) {
          toast.error("Could not find this order in Duffel.");
          return;
        }

        // Re-query the now-created flight_orders record
        const { data: retried } = await supabase
          .from("flight_orders")
          .select("*")
          .eq("trip_id", tripId)
          .eq("booking_reference", confirmationNumber)
          .maybeSingle();
        resolvedFlightOrder = retried;
        if (!resolvedFlightOrder) {
          toast.error("E-ticket record not found after refetch.");
          return;
        }
      }

      // Get trip + client info
      const { data: trip, error: tErr } = await supabase
        .from("trips")
        .select("trip_name, client_id, clients!trips_client_id_fkey(name, email)")
        .eq("id", tripId)
        .single();

      if (tErr || !trip) throw tErr || new Error("Trip not found");

      const client = (trip as any)?.clients;
      if (!client?.email) {
        toast.error("Client email not found — cannot send e-ticket.");
        return;
      }

      const eticketNumbers = (resolvedFlightOrder as any).eticket_numbers || [];
      const route = [resolvedFlightOrder.origin_iata, resolvedFlightOrder.destination_iata].filter(Boolean).join(" → ");
      const departureDate = resolvedFlightOrder.departure_at
        ? new Date(resolvedFlightOrder.departure_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "";
      const arrivalDate = resolvedFlightOrder.arrival_at
        ? new Date(resolvedFlightOrder.arrival_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "";

      const { error: emailErr } = await supabase.functions.invoke("send-email", {
        body: {
          to: client.email,
          subject: `Your E-Ticket Confirmation — ${resolvedFlightOrder.booking_reference || confirmationNumber}`,
          template: "eticket",
          clientId: trip.client_id,
          data: {
            clientName: client.name,
            passengerName: (resolvedFlightOrder.passenger_names || []).join(", ") || client.name,
            bookingReference: resolvedFlightOrder.booking_reference || confirmationNumber,
            airline: resolvedFlightOrder.airline_name || "Airline",
            flightNumbers: (resolvedFlightOrder.flight_numbers || []).join(", "),
            route,
            departureDate,
            arrivalDate,
            ticketNumbers: eticketNumbers.join(","),
            totalAmount: `$${(resolvedFlightOrder.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            tripName: trip.trip_name || "",
          },
        },
      });

      if (emailErr) throw emailErr;

      setSent(true);
      toast.success(`E-ticket sent to ${client.email}`);
      setTimeout(() => setSent(false), 5000);
    } catch (err: any) {
      console.error("Send e-ticket error:", err);
      toast.error(err.message || "Failed to send e-ticket");
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 h-7 text-xs"
      onClick={(e) => {
        e.stopPropagation();
        handleSend();
      }}
      disabled={sending || sent}
    >
      {sending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : sent ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Ticket className="h-3.5 w-3.5" />
      )}
      {sent ? "Sent!" : "Send E-Ticket"}
    </Button>
  );
}
