import { supabase } from "@/integrations/supabase/client";

/**
 * Shared trip-copy engine. Used by Clone Trip (and, as it is adopted, sub-trip
 * creation and the template library) so every copy path behaves the same.
 */
export interface CopyItineraryOptions {
  /** Keep item prices / supplier cost / commission on copied items. Default true. */
  includePricing?: boolean;
  /** Shift every date by this many days (e.g. new departure − old departure). Default 0. */
  dateShiftDays?: number;
  /**
   * Put every copied item into this existing itinerary instead of recreating the
   * source's itineraries (used by "sync from group trip").
   */
  intoItineraryId?: string | null;
}

export interface CopyItineraryResult {
  itineraries: number;
  optionBlocks: number;
  items: number;
}

function shiftDate(d: string | null | undefined, days: number): string | null {
  if (!d) return null;
  if (!days) return d;
  const dt = new Date(`${d.slice(0, 10)}T00:00:00`);
  if (isNaN(dt.getTime())) return d;
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole-day difference between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const da = new Date(`${a.slice(0, 10)}T00:00:00`).getTime();
  const db = new Date(`${b.slice(0, 10)}T00:00:00`).getTime();
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.round((db - da) / 86400000);
}

export async function copyItinerary(
  sourceTripId: string,
  targetTripId: string,
  userId: string,
  opts: CopyItineraryOptions = {},
): Promise<CopyItineraryResult> {
  const includePricing = opts.includePricing ?? true;
  const shift = opts.dateShiftDays ?? 0;
  const into = opts.intoItineraryId ?? null;

  const [itRes, obRes, itemRes] = await Promise.all([
    supabase.from("itineraries").select("*").eq("trip_id", sourceTripId).order("sort_order"),
    supabase.from("option_blocks").select("*").eq("trip_id", sourceTripId),
    supabase.from("itinerary_items").select("*").eq("trip_id", sourceTripId),
  ]);
  if (itRes.error) throw itRes.error;
  if (obRes.error) throw obRes.error;
  if (itemRes.error) throw itemRes.error;

  const itinMap = new Map<string, string>();
  for (const it of into ? [] : ((itRes.data as any[]) || [])) {
    const { data, error } = await supabase
      .from("itineraries")
      .insert({
        trip_id: targetTripId,
        user_id: userId,
        name: it.name,
        sort_order: it.sort_order,
        cover_image_url: it.cover_image_url,
        overview: it.overview,
        depart_date: shiftDate(it.depart_date, shift),
        return_date: shiftDate(it.return_date, shift),
        header_style: it.header_style,
        font_style: it.font_style,
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    itinMap.set(it.id, (data as any).id);
  }

  const blockMap = new Map<string, string>();
  const blocks = (obRes.data as any[]) || [];
  if (blocks.length) {
    const rows = blocks.map((b) => {
      const id = crypto.randomUUID();
      blockMap.set(b.id, id);
      return {
        id,
        trip_id: targetTripId,
        user_id: userId,
        itinerary_id: into ?? (b.itinerary_id ? itinMap.get(b.itinerary_id) ?? null : null),
        day_number: b.day_number,
        title: b.title,
        sort_order: b.sort_order,
      };
    });
    const { error } = await supabase.from("option_blocks").insert(rows as any);
    if (error) throw error;
  }

  const items = (itemRes.data as any[]) || [];
  if (items.length) {
    const rows = items.map((i) => ({
      trip_id: targetTripId,
      user_id: userId,
      itinerary_id: into ?? (i.itinerary_id ? itinMap.get(i.itinerary_id) ?? null : null),
      option_block_id: i.option_block_id ? blockMap.get(i.option_block_id) ?? null : null,
      day_number: i.day_number,
      item_date: shiftDate(i.item_date, shift),
      start_time: i.start_time,
      end_time: i.end_time,
      title: i.title,
      description: i.description,
      category: i.category,
      location: i.location,
      notes: i.notes,
      sort_order: i.sort_order,
      flight_number: i.flight_number,
      departure_city_code: i.departure_city_code,
      arrival_city_code: i.arrival_city_code,
      is_hidden: i.is_hidden,
      image_url: i.image_url,
      thumbnail_url: i.thumbnail_url,
      gallery_urls: i.gallery_urls ?? [],
      supplier_name: i.supplier_name,
      item_price: includePricing ? i.item_price : null,
      supplier_cost: includePricing ? i.supplier_cost : null,
      commission_amount: includePricing ? i.commission_amount : null,
      // Booking-specific fields are never copied: the new trip has its own bookings.
      booking_id: null,
      confirmation_number: null,
      booking_status: null,
      flight_status: null,
    }));
    for (let k = 0; k < rows.length; k += 200) {
      const { error } = await supabase.from("itinerary_items").insert(rows.slice(k, k + 200) as any);
      if (error) throw error;
    }
  }

  return { itineraries: itinMap.size, optionBlocks: blocks.length, items: items.length };
}

/** Group sub-trips: itinerary only, no item prices (pricing comes from the group's equal-share rules). */
export const GROUP_SUBTRIP_COPY: CopyItineraryOptions = { includePricing: false };
