import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { supabase } from "@/integrations/supabase/client";
import { TripCoverImage } from "@/components/trips/TripCoverImage";

interface TripPageEditorProps {
  trip: {
    id: string;
    notes: string | null;
    cover_image_url?: string | null;
  };
  onUpdated: () => void;
  onOverviewFocusChange?: (focused: boolean) => void;
  generatedOverview?: { html: string; requestId: number } | null;
}

export function TripPageEditor({ trip, onUpdated, onOverviewFocusChange, generatedOverview }: TripPageEditorProps) {
  const [overview, setOverview] = useState(trip.notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOverview(trip.notes || "");
  }, [trip.id, trip.notes]);

  useEffect(() => {
    if (generatedOverview) setOverview(generatedOverview.html);
  }, [generatedOverview]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("trips")
        .update({ notes: overview.trim() || null })
        .eq("id", trip.id);

      if (error) throw error;
      toast.success("Trip page saved");
      onUpdated();
    } catch (error) {
      console.error("Error saving trip page:", error);
      toast.error("Failed to save trip page");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Trip Page</h2>
        <p className="text-sm text-muted-foreground">
          Edit the cover and overview clients will see for this trip.
        </p>
      </div>

      <TripCoverImage
        tripId={trip.id}
        coverImageUrl={trip.cover_image_url}
        onUpdated={onUpdated}
      />

      <div className="space-y-2 border-t border-border pt-5">
        <Label>About this trip</Label>
        <RichTextEditor
          value={overview}
          onChange={setOverview}
          onFocus={() => onOverviewFocusChange?.(true)}
          onBlur={() => onOverviewFocusChange?.(false)}
          placeholder="Enter a welcoming overview of the trip, key highlights, and what travelers can expect."
          minHeight={220}
        />
        <p className="text-xs text-muted-foreground">
          This overview is shown to clients. Keep internal notes in the booking or itinerary item notes.
        </p>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={save} disabled={saving || overview === (trip.notes || "")}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Trip Page
        </Button>
      </div>
    </div>
  );
}