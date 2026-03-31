import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HotelOccupancy {
  rooms: number;
  adults: number;
  children: number;
  paxes?: { type: "AD" | "CH"; age?: number }[];
}

export interface HotelSearchParams {
  checkIn: string;
  checkOut: string;
  destination?: string;
  occupancies: HotelOccupancy[];
  filter?: {
    minCategory?: number;
    maxCategory?: number;
    maxRooms?: number;
    maxRatesPerRoom?: number;
  };
}

export interface HotelRate {
  rateKey: string;
  rateClass: string;
  rateType: string;
  net: string;
  sellingRate?: string;
  discount?: string;
  discountPCT?: string;
  allotment: number;
  paymentType: string;
  boardCode: string;
  boardName: string;
  rooms: number;
  adults: number;
  children: number;
  cancellationPolicies?: { amount: string; from: string }[];
}

export interface HotelRoom {
  code: string;
  name: string;
  rates: HotelRate[];
}

export interface HotelResult {
  code: number;
  name: string;
  categoryCode: string;
  categoryName: string;
  destinationCode: string;
  destinationName: string;
  zoneCode: string;
  zoneName: string;
  latitude: string;
  longitude: string;
  rooms: HotelRoom[];
  minRate: string;
  maxRate: string;
  currency: string;
}

export interface CheckRateResult {
  hotel: {
    code: number;
    name: string;
    categoryName: string;
    destinationName: string;
    rooms: HotelRoom[];
    currency: string;
  };
}

export function useHotelSearch() {
  const [hotels, setHotels] = useState<HotelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingRate, setCheckingRate] = useState(false);
  const [booking, setBooking] = useState(false);
  const [checkedRate, setCheckedRate] = useState<any>(null);

  const invoke = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("hotelbeds", { body });
    if (error) throw error;
    return data?.data;
  };

  const searchHotels = async (params: HotelSearchParams) => {
    setLoading(true);
    setHotels([]);
    setCheckedRate(null);
    try {
      const result = await invoke({ action: "search", ...params });
      setHotels(result?.hotels?.hotels ?? []);
      if (!result?.hotels?.hotels?.length) {
        toast.info("No hotels found for those criteria.");
      }
    } catch (err: any) {
      console.error("Hotel search error:", err);
      toast.error(err.message || "Failed to search hotels");
    } finally {
      setLoading(false);
    }
  };

  const checkRate = async (rateKeys: string[]) => {
    setCheckingRate(true);
    setCheckedRate(null);
    try {
      const result = await invoke({
        action: "checkrate",
        rooms: rateKeys.map((rateKey) => ({ rateKey })),
      });
      setCheckedRate(result);
      return result;
    } catch (err: any) {
      console.error("Check rate error:", err);
      toast.error(err.message || "Failed to check rate");
      return null;
    } finally {
      setCheckingRate(false);
    }
  };

  const confirmBooking = async (params: {
    holder: { name: string; surname: string };
    rooms: { rateKey: string; paxes: { roomId: number; type: string; name: string; surname: string }[] }[];
    clientReference?: string;
    remark?: string;
  }) => {
    setBooking(true);
    try {
      const result = await invoke({ action: "book", ...params });
      toast.success("Hotel booking confirmed!");
      return result;
    } catch (err: any) {
      console.error("Booking error:", err);
      toast.error(err.message || "Failed to confirm booking");
      return null;
    } finally {
      setBooking(false);
    }
  };

  const getBooking = async (bookingId: string) => {
    try {
      return await invoke({ action: "get_booking", bookingId });
    } catch (err: any) {
      toast.error(err.message || "Failed to retrieve booking");
      return null;
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      const result = await invoke({ action: "cancel", bookingId });
      toast.success("Booking cancelled");
      return result;
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel booking");
      return null;
    }
  };

  const getHotelDetails = async (hotelCodes: number | number[], language?: string) => {
    try {
      return await invoke({ action: "hotel_details", hotelCodes, language });
    } catch (err: any) {
      toast.error(err.message || "Failed to get hotel details");
      return null;
    }
  };

  const getVoucher = async (bookingId: string) => {
    try {
      return await invoke({ action: "voucher", bookingId });
    } catch (err: any) {
      toast.error(err.message || "Failed to get voucher");
      return null;
    }
  };

  return {
    hotels,
    loading,
    searchHotels,
    checkRate,
    checkingRate,
    checkedRate,
    confirmBooking,
    booking,
    getBooking,
    cancelBooking,
    getHotelDetails,
    getVoucher,
  };
}
