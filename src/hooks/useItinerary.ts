import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ItineraryItem {
  id: string;
  trip_id: string;
  user_id: string;
  booking_id: string | null;
  day_number: number;
  item_date: string | null;
  start_time: string | null;
  end_time: string | null;
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateItineraryItemData {
  trip_id: string;
  day_number: number;
  title: string;
  description?: string;
  category?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  item_date?: string;
  notes?: string;
  booking_id?: string;
  sort_order?: number;
}

export function useItinerary(tripId: string | undefined) {
  const { user } = useAuth();
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!user || !tripId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setItems((data as ItineraryItem[]) || []);
    } catch (error) {
      console.error("Error fetching itinerary:", error);
    } finally {
      setLoading(false);
    }
  }, [user, tripId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async (data: CreateItineraryItemData) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from("itinerary_items")
        .insert({ ...data, user_id: user.id } as any);
      if (error) throw error;
      toast.success("Item added");
      await fetchItems();
      return true;
    } catch (error) {
      console.error("Error adding itinerary item:", error);
      toast.error("Failed to add item");
      return false;
    }
  };

  const updateItem = async (itemId: string, data: Partial<CreateItineraryItemData>) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from("itinerary_items")
        .update(data as any)
        .eq("id", itemId);
      if (error) throw error;
      await fetchItems();
      return true;
    } catch (error) {
      console.error("Error updating itinerary item:", error);
      toast.error("Failed to update item");
      return false;
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from("itinerary_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
      toast.success("Item removed");
      await fetchItems();
      return true;
    } catch (error) {
      console.error("Error deleting itinerary item:", error);
      toast.error("Failed to remove item");
      return false;
    }
  };

  const generateWithAI = async (
    destination: string | null,
    departDate: string | null,
    returnDate: string | null,
    tripName: string,
    existingBookings: any[],
    preferences?: string
  ) => {
    if (!user || !tripId) return false;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-itinerary", {
        body: { destination, departDate, returnDate, tripName, existingBookings, preferences },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return false; }

      const aiItems = data?.items || [];
      if (aiItems.length === 0) {
        toast.error("AI couldn't generate an itinerary. Try adding more trip details.");
        return false;
      }

      // Insert all AI-generated items
      const inserts = aiItems.map((item: any, idx: number) => ({
        trip_id: tripId,
        user_id: user.id,
        day_number: item.day_number || 1,
        title: item.title,
        description: item.description || null,
        category: item.category || "activity",
        location: item.location || null,
        start_time: item.start_time || null,
        end_time: item.end_time || null,
        sort_order: idx,
      }));

      const { error: insertError } = await supabase
        .from("itinerary_items")
        .insert(inserts as any);
      if (insertError) throw insertError;

      toast.success(`Generated ${aiItems.length} itinerary items!`);
      await fetchItems();
      return true;
    } catch (error) {
      console.error("Error generating itinerary:", error);
      toast.error("Failed to generate itinerary");
      return false;
    } finally {
      setGenerating(false);
    }
  };

  const clearAll = async () => {
    if (!user || !tripId) return false;
    try {
      const { error } = await supabase
        .from("itinerary_items")
        .delete()
        .eq("trip_id", tripId);
      if (error) throw error;
      toast.success("Itinerary cleared");
      setItems([]);
      return true;
    } catch (error) {
      console.error("Error clearing itinerary:", error);
      toast.error("Failed to clear itinerary");
      return false;
    }
  };

  const importFromBookings = async (bookings: any[]) => {
    if (!user || !tripId || bookings.length === 0) return false;
    try {
      const inserts = bookings.map((b: any, idx: number) => ({
        trip_id: tripId,
        user_id: user.id,
        booking_id: b.id,
        day_number: 1,
        title: b.trip_name || b.destination || "Booking",
        description: `${b.suppliers?.supplier_type || "Booking"} - ${b.booking_reference}`,
        category: mapSupplierType(b.suppliers?.supplier_type),
        location: b.destination,
        sort_order: idx,
      }));
      const { error } = await supabase
        .from("itinerary_items")
        .insert(inserts as any);
      if (error) throw error;
      toast.success(`Imported ${bookings.length} booking(s)`);
      await fetchItems();
      return true;
    } catch (error) {
      console.error("Error importing bookings:", error);
      toast.error("Failed to import bookings");
      return false;
    }
  };

  return { items, loading, generating, fetchItems, addItem, updateItem, deleteItem, generateWithAI, clearAll, importFromBookings };
}

function mapSupplierType(type?: string): string {
  const map: Record<string, string> = {
    airline: "flight", hotel: "hotel", cruise: "cruise",
    "car rental": "transportation", restaurant: "dining",
    "tour operator": "activity",
  };
  return map[type?.toLowerCase() || ""] || "activity";
}
