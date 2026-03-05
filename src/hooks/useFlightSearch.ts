import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FlightSlice {
  origin: string;
  destination: string;
  departure_date: string;
}

export interface FlightPassenger {
  type: "adult" | "child" | "infant_without_seat";
  age?: number;
}

export interface FlightSearchParams {
  slices: FlightSlice[];
  passengers: FlightPassenger[];
  cabin_class: string;
}

export interface FlightOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: { name: string; logo_symbol_url: string | null; iata_code: string };
  slices: Array<{
    id: string;
    origin: { iata_code: string; name: string; city_name: string };
    destination: { iata_code: string; name: string; city_name: string };
    duration: string;
    segments: Array<{
      id: string;
      origin: { iata_code: string; name: string };
      destination: { iata_code: string; name: string };
      departing_at: string;
      arriving_at: string;
      operating_carrier: { name: string; logo_symbol_url: string | null; iata_code: string };
      operating_carrier_flight_number: string;
      duration: string;
    }>;
  }>;
  passengers: Array<{ id: string; type: string }>;
}

export function useFlightSearch() {
  const [offers, setOffers] = useState<FlightOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [offerRequestId, setOfferRequestId] = useState<string | null>(null);

  const searchFlights = async (params: FlightSearchParams) => {
    setLoading(true);
    setOffers([]);
    try {
      const { data, error } = await supabase.functions.invoke("duffel-flights", {
        body: { action: "search", ...params },
      });
      if (error) throw error;
      const result = data?.data;
      setOfferRequestId(result?.id ?? null);
      setOffers(result?.offers ?? []);
      if (!result?.offers?.length) {
        toast.info("No flights found for those criteria.");
      }
    } catch (err: any) {
      console.error("Flight search error:", err);
      toast.error(err.message || "Failed to search flights");
    } finally {
      setLoading(false);
    }
  };

  const getOffer = async (offerId: string) => {
    const { data, error } = await supabase.functions.invoke("duffel-flights", {
      body: { action: "get_offer", offer_id: offerId },
    });
    if (error) throw error;
    return data?.data;
  };

  return { offers, loading, searchFlights, getOffer, offerRequestId };
}
