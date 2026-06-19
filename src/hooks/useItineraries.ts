import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Itinerary {
  id: string;
  trip_id: string;
  user_id: string;
  name: string;
  sort_order: number;
  cover_image_url: string | null;
  overview: string | null;
  depart_date: string | null;
  return_date: string | null;
  header_style: string | null;   // 'full_bleed' | 'large' | 'minimized' | 'legacy'
  font_style: string | null;     // 'standard' | 'sans' | 'serif'
  created_at: string;
  updated_at: string;
}

export function useItineraries(tripId: string | undefined) {
  const { user } = useAuth();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchItineraries = useCallback(async () => {
    if (!user || !tripId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("itineraries")
        .select("*")
        .eq("trip_id", tripId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const list = (data as Itinerary[]) || [];
      setItineraries(list);
      // Auto-select first if none active
      if (list.length > 0 && (!activeId || !list.find(i => i.id === activeId))) {
        setActiveId(list[0].id);
      }
    } catch (error) {
      console.error("Error fetching itineraries:", error);
    } finally {
      setLoading(false);
    }
  }, [user, tripId]);

  useEffect(() => { fetchItineraries(); }, [fetchItineraries]);

  const createItinerary = async (opts?: { name?: string; depart_date?: string; return_date?: string; cover_image_url?: string; overview?: string }) => {
    if (!user || !tripId) return null;
    const newName = opts?.name || `Itinerary ${itineraries.length + 1}`;
    try {
      const { data, error } = await supabase
        .from("itineraries")
        .insert({
          trip_id: tripId,
          user_id: user.id,
          name: newName,
          sort_order: itineraries.length,
          depart_date: opts?.depart_date || null,
          return_date: opts?.return_date || null,
          cover_image_url: opts?.cover_image_url || null,
          overview: opts?.overview || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const created = data as Itinerary;
      toast.success(`Created "${newName}"`);
      await fetchItineraries();
      setActiveId(created.id);
      return created;
    } catch (error) {
      console.error("Error creating itinerary:", error);
      toast.error("Failed to create itinerary");
      return null;
    }
  };

  const renameItinerary = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from("itineraries")
        .update({ name } as any)
        .eq("id", id);
      if (error) throw error;
      await fetchItineraries();
      return true;
    } catch (error) {
      console.error("Error renaming itinerary:", error);
      toast.error("Failed to rename");
      return false;
    }
  };

  const updateItinerary = async (id: string, updates: { name?: string; depart_date?: string | null; return_date?: string | null; cover_image_url?: string | null; overview?: string | null; header_style?: string | null; font_style?: string | null }) => {
    try {
      const { error } = await supabase
        .from("itineraries")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Itinerary updated");
      await fetchItineraries();
      return true;
    } catch (error) {
      console.error("Error updating itinerary:", error);
      toast.error("Failed to update");
      return false;
    }
  };

  const deleteItinerary = async (id: string) => {
    try {
      const { error } = await supabase
        .from("itineraries")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Itinerary deleted");
      await fetchItineraries();
      return true;
    } catch (error) {
      console.error("Error deleting itinerary:", error);
      toast.error("Failed to delete");
      return false;
    }
  };

  const duplicateItinerary = async (id: string) => {
    if (!user || !tripId) return null;
    const source = itineraries.find((i) => i.id === id);
    if (!source) {
      toast.error("Itinerary not found");
      return null;
    }
    try {
      // 1. Create the new itinerary
      const newName = `${source.name} (Copy)`;
      const { data: created, error: createError } = await supabase
        .from("itineraries")
        .insert({
          trip_id: tripId,
          user_id: user.id,
          name: newName,
          sort_order: itineraries.length,
          depart_date: source.depart_date,
          return_date: source.return_date,
          cover_image_url: source.cover_image_url,
          overview: source.overview,
        } as any)
        .select()
        .single();
      if (createError) throw createError;
      const newItin = created as Itinerary;

      // 2. Copy items (excluding booking_id so duplicates don't share live booking links)
      const { data: srcItems, error: itemsError } = await supabase
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", tripId)
        .eq("itinerary_id", id);
      if (itemsError) throw itemsError;

      if (srcItems && srcItems.length > 0) {
        const cloned = (srcItems as any[]).map((it) => {
          const { id: _id, created_at, updated_at, booking_id, ...rest } = it;
          return {
            ...rest,
            itinerary_id: newItin.id,
            user_id: user.id,
          };
        });
        const { error: insertError } = await supabase
          .from("itinerary_items")
          .insert(cloned as any);
        if (insertError) throw insertError;
      }

      toast.success(`Duplicated as "${newName}"`);
      await fetchItineraries();
      setActiveId(newItin.id);
      return newItin;
    } catch (error) {
      console.error("Error duplicating itinerary:", error);
      toast.error("Failed to duplicate itinerary");
      return null;
    }
  };

  // Auto-create a default itinerary if none exist once loading is done
  const ensureDefault = useCallback(async () => {
    if (!loading && itineraries.length === 0 && user && tripId) {
      await createItinerary({ name: "Itinerary 1" });
    }
  }, [loading, itineraries.length, user, tripId]);

  useEffect(() => { ensureDefault(); }, [ensureDefault]);

  return {
    itineraries,
    activeId,
    setActiveId,
    loading,
    createItinerary,
    updateItinerary,
    renameItinerary,
    deleteItinerary,
    duplicateItinerary,
  };
}
