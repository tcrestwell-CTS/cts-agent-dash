import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface TripOption {
  id: string;
  trip_name: string;
  destination: string | null;
  status: string;
  trip_type?: string | null;
  clients?: { name: string } | null;
}

interface ItineraryItemData {
  day_number: number;
  title: string;
  description?: string;
  category: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
  flight_number?: string;
  departure_city_code?: string;
  arrival_city_code?: string;
  item_date?: string;
}

export interface FlightOfferMeta {
  totalAmount: number;
  currency: string;
  airlineName: string;
  confirmationLabel: string;
  departureDate: string | null;
  returnDate: string | null;
  offerId?: string;
}

export interface CruiseOfferMeta {
  totalAmount: number;
  currency: string;
  cruiseLineName: string;
  shipName?: string | null;
  sailingName: string;
  cabinDescription?: string | null;
  holidayRef?: string | null;
  dateRef?: string | null;
  departureDate: string | null;
  returnDate: string | null;
  destination?: string | null;
}

export interface CruiseCabinChoice {
  category_name: string;   // e.g. "Balcony — BA Deluxe Balcony"
  description?: string | null;
  price_per_person: number;
  deposit_amount?: number;
  capacity?: number | null;
}

interface AddToTripSelectorProps {
  items: ItineraryItemData[];
  disabled?: boolean;
  label?: string;
  defaultTripId?: string;
  flightOffer?: FlightOfferMeta;
  cruiseOffer?: CruiseOfferMeta;
  cruiseCabinChoices?: CruiseCabinChoice[];
}

export function AddToTripSelector({ items, disabled, label = "Add to Trip", defaultTripId, flightOffer, cruiseOffer, cruiseCabinChoices }: AddToTripSelectorProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>(defaultTripId || "");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("trips")
      .select("id, trip_name, destination, status, trip_type, clients!trips_client_id_fkey(name)")
      .in("status", ["lead", "planning", "quoting", "booked", "active"])
      .order("updated_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) setTrips(data as TripOption[]);
        setLoading(false);
      });
  }, [user]);

  const handleAdd = async () => {
    if (!selectedTripId || !user) return;
    // Allow adding when we have either itinerary items OR a cruise/flight offer to record
    if (items.length === 0 && !cruiseOffer && !flightOffer) return;
    setAdding(true);
    try {
      // Get the first itinerary for this trip so items appear in the builder
      const { data: itineraries } = await supabase
        .from("itineraries")
        .select("id")
        .eq("trip_id", selectedTripId)
        .order("sort_order", { ascending: true })
        .limit(1);
      
      const itineraryId = itineraries?.[0]?.id || null;

      // Get max sort_order for the trip
      const { data: existing } = await supabase
        .from("itinerary_items")
        .select("sort_order")
        .eq("trip_id", selectedTripId)
        .order("sort_order", { ascending: false })
        .limit(1);
      
      let nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

      const itemsToInsert = items.length > 0
        ? items
        : cruiseOffer
          ? [
              {
                day_number: 1,
                title: `${cruiseOffer.cruiseLineName}${cruiseOffer.shipName ? ` — ${cruiseOffer.shipName}` : ""}: ${cruiseOffer.sailingName}`,
                description: cruiseOffer.cabinDescription || undefined,
                category: "cruise",
                location: cruiseOffer.destination || undefined,
                item_date: cruiseOffer.departureDate || undefined,
                notes: cruiseOffer.holidayRef ? `Widgety ref: ${cruiseOffer.holidayRef}` : undefined,
              } as ItineraryItemData,
            ]
          : [];

      const inserts = itemsToInsert.map((item, idx) => ({
        trip_id: selectedTripId,
        user_id: user.id,
        itinerary_id: itineraryId,
        day_number: item.day_number,
        title: item.title,
        description: item.description || null,
        category: item.category,
        location: item.location || null,
        start_time: item.start_time || null,
        end_time: item.end_time || null,
        notes: item.notes || null,
        flight_number: item.flight_number || null,
        departure_city_code: item.departure_city_code || null,
        arrival_city_code: item.arrival_city_code || null,
        item_date: item.item_date || null,
        sort_order: nextOrder + idx,
      }));

      if (inserts.length > 0) {
        const { error } = await supabase.from("itinerary_items").insert(inserts);
        if (error) throw error;
      }

      // Create a booking with cost information if flight offer data is provided
      if (flightOffer && flightOffer.totalAmount > 0) {
        const { data: newBooking } = await supabase.from("bookings").insert({
          user_id: user.id,
          trip_id: selectedTripId,
          confirmation_number: flightOffer.confirmationLabel,
          status: "pending",
          gross_sales: flightOffer.totalAmount,
          total_price: flightOffer.totalAmount,
          net_sales: flightOffer.totalAmount,
          commissionable_amount: flightOffer.totalAmount,
          duffel_offer_id: flightOffer.offerId || null,
        }).select("id").single();

        if (newBooking) {
          // Create margin line
          await supabase.from("booking_margin_lines").insert({
            booking_id: newBooking.id,
            user_id: user.id,
            line_type: "flight",
            description: `${flightOffer.airlineName} — ${flightOffer.confirmationLabel}`,
            source: "duffel",
            quantity: 1,
            unit_cost: flightOffer.totalAmount,
            unit_sell: flightOffer.totalAmount,
            is_pass_through: false,
            sort_order: 0,
          });

          // Trigger margin calculation
          await supabase.rpc("calculate_booking_margin", {
            p_booking_id: newBooking.id,
            p_advisor_split: null,
            p_force_recalc: false,
          });
        }
      }

      // Create a booking with cost information for a cruise offer
      if (cruiseOffer && cruiseOffer.totalAmount > 0) {
        const { data: newBooking } = await supabase.from("bookings").insert({
          user_id: user.id,
          trip_id: selectedTripId,
          confirmation_number: cruiseOffer.holidayRef || cruiseOffer.dateRef || `CRUISE-${Date.now()}`,
          status: "pending",
          gross_sales: cruiseOffer.totalAmount,
          total_price: cruiseOffer.totalAmount,
          net_sales: cruiseOffer.totalAmount,
          commissionable_amount: cruiseOffer.totalAmount,
          source: "widgety_search",
        }).select("id").single();

        if (newBooking) {
          await supabase.from("booking_margin_lines").insert({
            booking_id: newBooking.id,
            user_id: user.id,
            line_type: "cruise",
            description: [
              `${cruiseOffer.cruiseLineName}${cruiseOffer.shipName ? ` — ${cruiseOffer.shipName}` : ""}`,
              cruiseOffer.sailingName,
              cruiseOffer.cabinDescription,
            ].filter(Boolean).join(" • "),
            source: "widgety",
            quantity: 1,
            unit_cost: cruiseOffer.totalAmount,
            unit_sell: cruiseOffer.totalAmount,
            is_pass_through: false,
            sort_order: 0,
          });

          await supabase.rpc("calculate_booking_margin", {
            p_booking_id: newBooking.id,
            p_advisor_split: null,
            p_force_recalc: false,
          });
        }
      }

      // Update trip departure/return dates from flight dates
      if (flightOffer) {
        const dateUpdates: Record<string, string> = {};
        if (flightOffer.departureDate) dateUpdates.depart_date = flightOffer.departureDate;
        if (flightOffer.returnDate) dateUpdates.return_date = flightOffer.returnDate;
        if (Object.keys(dateUpdates).length > 0) {
          await supabase.from("trips").update(dateUpdates).eq("id", selectedTripId);
        }
      }

      // Update trip departure/return dates from cruise dates
      if (cruiseOffer) {
        const dateUpdates: Record<string, string> = {};
        if (cruiseOffer.departureDate) dateUpdates.depart_date = cruiseOffer.departureDate;
        if (cruiseOffer.returnDate) dateUpdates.return_date = cruiseOffer.returnDate;
        if (Object.keys(dateUpdates).length > 0) {
          await supabase.from("trips").update(dateUpdates).eq("id", selectedTripId);
        }
      }

      // For GROUP trips, populate trip_cabin_options with every available cabin choice
      const selectedTrip = trips.find((t) => t.id === selectedTripId);
      if (
        selectedTrip?.trip_type === "group" &&
        cruiseCabinChoices &&
        cruiseCabinChoices.length > 0
      ) {
        // Read existing options to avoid creating duplicates
        const { data: existingOpts } = await supabase
          .from("trip_cabin_options")
          .select("category_name, sort_order")
          .eq("trip_id", selectedTripId);

        const existingNames = new Set(
          (existingOpts || []).map((o: any) => (o.category_name || "").trim().toLowerCase()),
        );
        const baseSort = (existingOpts || []).reduce(
          (max: number, o: any) => Math.max(max, o.sort_order ?? 0),
          -1,
        ) + 1;

        // Dedupe incoming choices by category name (keep the cheapest)
        const uniqueByName = new Map<string, CruiseCabinChoice>();
        for (const c of cruiseCabinChoices) {
          const key = c.category_name.trim().toLowerCase();
          if (!key || existingNames.has(key)) continue;
          const prev = uniqueByName.get(key);
          if (!prev || c.price_per_person < prev.price_per_person) {
            uniqueByName.set(key, c);
          }
        }

        const cabinInserts = Array.from(uniqueByName.values()).map((c, idx) => ({
          trip_id: selectedTripId,
          category_name: c.category_name,
          description: c.description ?? null,
          price_per_person: c.price_per_person,
          deposit_amount: c.deposit_amount ?? 0,
          capacity: c.capacity ?? null,
          sort_order: baseSort + idx,
        }));

        if (cabinInserts.length > 0) {
          const { error: cabinErr } = await supabase
            .from("trip_cabin_options")
            .insert(cabinInserts);
          if (cabinErr) {
            console.warn("Failed to seed cabin options:", cabinErr);
          }
        }
      }

      const tripName = trips.find(t => t.id === selectedTripId)?.trip_name || "trip";
      const isGroupCruise =
        selectedTrip?.trip_type === "group" &&
        cruiseCabinChoices &&
        cruiseCabinChoices.length > 0;
      const summary = cruiseOffer
        ? `Added cruise to ${tripName}${cruiseOffer.totalAmount > 0 ? " with booking" : ""}${isGroupCruise ? " — cabin options populated" : ""}`
        : `Added ${items.length} item${items.length === 1 ? "" : "s"} to ${tripName}${flightOffer ? " with booking" : ""}`;
      toast.success(summary, {
        action: {
          label: "View Trip",
          onClick: () => navigate(`/trips/${selectedTripId}`),
        },
      });
    } catch (err: any) {
      console.error("Add to trip error:", err);
      toast.error(err.message || "Failed to add to trip");
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading trips…</p>;
  if (trips.length === 0) return <p className="text-sm text-muted-foreground">No active trips found. Create a trip first to add items.</p>;

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedTripId} onValueChange={setSelectedTripId}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select a trip..." />
        </SelectTrigger>
        <SelectContent>
          {trips.map((trip) => (
            <SelectItem key={trip.id} value={trip.id}>
              <span className="truncate">
                {trip.trip_name}
                {trip.clients?.name ? ` — ${trip.clients.name}` : ""}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={handleAdd}
        disabled={!selectedTripId || disabled || adding || (items.length === 0 && !cruiseOffer && !flightOffer)}
        size="sm"
        className="gap-1.5"
      >
        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
        {label}
      </Button>
    </div>
  );
}
