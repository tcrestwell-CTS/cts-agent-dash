import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// RateHawk/ETG b2b.Hotel shape (SERP stage — lowest rate per hotel only)
export interface RateHawkRate {
  book_hash?: string;
  match_hash?: string;
  room_name?: string;
  meal?: string;
  meal_data?: { value?: string; has_breakfast?: boolean; no_child_meal?: boolean };
  daily_prices?: string[];
  allotment?: number;
  payment_options?: {
    payment_types?: {
      amount?: string;
      show_amount?: string;
      currency_code?: string;
      show_currency_code?: string;
      type?: string;
      tax_data?: { taxes?: { included_by_supplier?: boolean; amount?: string }[] };
      cancellation_penalties?: { free_cancellation_before?: string | null; policies?: any[] };
    }[];
  };
}

export interface RateHawkHotel {
  id: string;
  hid: number;
  rates: RateHawkRate[];
  bar_price_data?: any;
}

export interface RateHawkCertHotel {
  id: string;
  name?: string;
  [key: string]: any;
}

// Certification sandbox hotel IDs (see mem/features/integrations/ratehawk-etg.md)
const CERT_HOTEL_IDS = ["10004834", "8819557"];

export function useRateHawkSearch() {
  const [hotels, setHotels] = useState<RateHawkHotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [certHotels, setCertHotels] = useState<RateHawkCertHotel[]>([]);
  const [certHotelsLoading, setCertHotelsLoading] = useState(false);

  const invoke = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("ratehawk", { body });
    if (error) throw error;
    if (data?.code === "RATEHAWK_QUOTA_EXCEEDED") {
      throw new Error("RateHawk daily quota exceeded — please try again later.");
    }
    if (data?.fallback && data?.error) {
      throw new Error(data.error);
    }
    return data?.data;
  };

  const searchHotels = async (params: {
    checkIn: string;
    checkOut: string;
    ids: string[];
    adults?: number;
    children?: number[];
  }) => {
    setLoading(true);
    setHotels([]);
    try {
      const result = await invoke({
        action: "search_by_hotel_ids",
        checkin: params.checkIn,
        checkout: params.checkOut,
        ids: params.ids,
        guests: [{ adults: params.adults ?? 2, children: params.children ?? [] }],
      });
      const found: RateHawkHotel[] = result?.hotels ?? [];
      setHotels(found);
      if (!found.length) {
        toast.info("No rates found for those criteria.");
      }
    } catch (err: any) {
      console.error("RateHawk search error:", err);
      toast.error(err.message || "Failed to search RateHawk hotels");
    } finally {
      setLoading(false);
    }
  };

  const listCertificationHotels = async () => {
    setCertHotelsLoading(true);
    try {
      const result = await invoke({
        action: "get_cached_hotels",
        ids: CERT_HOTEL_IDS,
      });
      setCertHotels(result?.hotels ?? result ?? []);
    } catch (err: any) {
      console.error("RateHawk cert hotels error:", err);
      toast.error(err.message || "Failed to load RateHawk test hotels");
    } finally {
      setCertHotelsLoading(false);
    }
  };

  return { hotels, loading, searchHotels, certHotels, certHotelsLoading, listCertificationHotels };
}
