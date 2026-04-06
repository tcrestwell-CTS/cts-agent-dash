import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Loader2, Copy, Check, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  filterToActiveItinerary,
  sanitizePublishedItinerary,
  sanitizePublishedOptionBlocks,
} from "@/lib/publishedTrip";

interface PublishTripButtonProps {
  tripId: string;
  shareToken: string | null;
  publishedAt: string | null;
  updatedAt: string;
  onPublished: () => void;
}

export function PublishTripButton({
  tripId,
  shareToken,
  publishedAt,
  updatedAt,
  onPublished,
}: PublishTripButtonProps) {
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasUnpublishedChanges = !publishedAt || new Date(updatedAt) > new Date(publishedAt);
  const PRODUCTION_DOMAIN = "https://app.crestwelltravels.com";
  const clientUrl = shareToken
    ? `${PRODUCTION_DOMAIN}/shared/${shareToken}`
    : null;
  const previewUrl = shareToken
    ? `/shared/${shareToken}`
    : null;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // 1. Fetch itineraries first to determine which one to publish
      const [bookingsRes, itinerariesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, destination, depart_date, return_date, status, trip_name, cancellation_terms, payment_deadline, booking_type")
          .eq("trip_id", tripId),
        supabase
          .from("itineraries")
          .select("id, name, sort_order, cover_image_url, overview, depart_date, return_date")
          .eq("trip_id", tripId)
          .order("sort_order", { ascending: true }),
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (itinerariesRes.error) throw itinerariesRes.error;

      const itineraries = itinerariesRes.data || [];
      const activeItinerary = itineraries[0] || null;
      const activeItineraryId = activeItinerary?.id || null;

      // 2. Fetch all itinerary items and option blocks, then keep only the active itinerary if present.
      // This preserves older trips that don't have itinerary_id values while still excluding orphaned data.
      const [itineraryRes, optionBlocksRes] = await Promise.all([
        supabase
        .from("itinerary_items")
        .select("id, day_number, title, description, category, start_time, end_time, location, item_date, notes, sort_order, itinerary_id, option_block_id")
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true })
        .order("sort_order", { ascending: true }),
        supabase
          .from("option_blocks")
          .select("id, day_number, title, sort_order, itinerary_id")
          .eq("trip_id", tripId)
          .order("day_number", { ascending: true })
          .order("sort_order", { ascending: true }),
      ]);

      if (itineraryRes.error) throw itineraryRes.error;
      if (optionBlocksRes.error) throw optionBlocksRes.error;

      const publishedItinerary = sanitizePublishedItinerary(
        filterToActiveItinerary((itineraryRes.data as any[]) || [], activeItineraryId),
        {
          departDate: activeItinerary?.depart_date || null,
          returnDate: activeItinerary?.return_date || null,
        }
      );

      const publishedOptionBlocks = sanitizePublishedOptionBlocks(
        filterToActiveItinerary((optionBlocksRes.data as any[]) || [], activeItineraryId),
        {
          departDate: activeItinerary?.depart_date || null,
          returnDate: activeItinerary?.return_date || null,
        }
      );

      const snapshot = {
        itinerary: publishedItinerary,
        bookings: (bookingsRes.data || []).map((b: any) => ({
          destination: b.destination,
          depart_date: b.depart_date,
          return_date: b.return_date,
          status: b.status,
          trip_name: b.trip_name,
          booking_type: b.booking_type,
          cancellation_terms: b.cancellation_terms,
          payment_deadline: b.payment_deadline,
        })),
        itineraries: itineraries,
        optionBlocks: publishedOptionBlocks,
        snapshot_at: new Date().toISOString(),
      };

      // 2. Update trip with snapshot and published_at timestamp
      const { error } = await supabase
        .from("trips")
        .update({
          published_at: new Date().toISOString(),
          published_snapshot: snapshot,
        } as any)
        .eq("id", tripId);

      if (error) throw error;
      toast.success("Trip published successfully!");
      onPublished();
    } catch (error: any) {
      console.error("Error publishing trip:", error);
      const msg = error?.message || error?.details || "Unknown error";
      toast.error(`Failed to publish trip: ${msg}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleCopy = async () => {
    if (!clientUrl) return;
    await navigator.clipboard.writeText(clientUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Preview button */}
      {shareToken && (
        <Button variant="outline" size="sm" asChild>
          <a href={previewUrl!} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </a>
        </Button>
      )}

      {/* Publish button */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="relative"
          >
            <Globe className="h-4 w-4 mr-2" />
            {publishedAt ? "Published" : "Publish Trip"}
            {hasUnpublishedChanges && publishedAt && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-orange-500 border-2 border-background" />
            )}
            {!publishedAt && (
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                Draft
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm">Publish Trip Page</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {publishedAt
                  ? hasUnpublishedChanges
                    ? "Changes have been made since last publish. Publish again to update the public page."
                    : "Your trip page is live and up to date."
                  : "Publish this trip to create a shareable public itinerary page."}
              </p>
            </div>

            {hasUnpublishedChanges && publishedAt && (
              <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1.5">
                <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                Unpublished changes — clients see the last published version
              </div>
            )}

            <Button
              onClick={handlePublish}
              disabled={publishing || (!hasUnpublishedChanges && !!publishedAt)}
              className="w-full"
              size="sm"
            >
              {publishing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Publishing...</>
              ) : hasUnpublishedChanges ? (
                <><Globe className="h-4 w-4 mr-2" /> {publishedAt ? "Publish Updates" : "Publish Now"}</>
              ) : (
                "Up to Date"
              )}
            </Button>

            {publishedAt && clientUrl && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground">Client Share Link</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate">
                    {clientUrl}
                  </code>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
