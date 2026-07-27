import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Loader2, Copy, Check, Eye, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
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
  /** Readiness signals passed in from the trip detail page */
  coverImageUrl?: string | null;
  totalCost?: number | null;
  hasItineraryItems?: boolean;
  clientId?: string | null;
}

export function PublishTripButton({
  tripId,
  shareToken,
  publishedAt,
  updatedAt,
  onPublished,
  coverImageUrl,
  totalCost,
  hasItineraryItems,
  clientId,
}: PublishTripButtonProps) {
  // Readiness checklist items — evaluated before allowing publish
  const readinessChecks = [
    {
      label: "Cover image set",
      detail: "Add a cover photo so clients see a destination image at the top of their proposal",
      passed: !!coverImageUrl,
    },
    {
      label: "Total cost entered",
      detail: "Set a trip total so clients can see the investment amount",
      passed: !!totalCost && totalCost > 0,
    },
    {
      label: "Itinerary has items",
      detail: "Add at least one itinerary item so clients see their day-by-day plan",
      passed: !!hasItineraryItems,
    },
    {
      label: "Client linked",
      detail: "Link a client contact so the proposal is personalised",
      passed: !!clientId,
    },
  ];
  const passedCount = readinessChecks.filter(c => c.passed).length;
  const allPassed = passedCount === readinessChecks.length;
  const blockers = readinessChecks.filter(c => !c.passed);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasUnpublishedChanges = !publishedAt || new Date(updatedAt) > new Date(publishedAt);
  const PRODUCTION_DOMAIN = "https://app.crestwelltravels.com";
  const clientUrl = shareToken
    ? `${PRODUCTION_DOMAIN}/shared/${shareToken}`
    : null;
  const previewUrl = shareToken
    ? `/shared/${shareToken}?preview=true`
    : null;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // 1. Fetch itineraries first to determine which one to publish
      const [bookingsRes, itinerariesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, confirmation_number, status, gross_sales, total_price, supplier_id, suppliers(name, supplier_type)")
          .eq("trip_id", tripId),
        supabase
          .from("itineraries")
          .select("id, name, sort_order, cover_image_url, overview, depart_date, return_date, header_style, font_style")
          .eq("trip_id", tripId)
          .order("sort_order", { ascending: true }),
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (itinerariesRes.error) throw itinerariesRes.error;

      const itineraries = itinerariesRes.data || [];

      // 2. Fetch ALL itinerary items and option blocks across every itinerary.
      // The shared-trip edge function re-groups and sanitizes per itinerary_id,
      // so the snapshot must include items for every published itinerary.
      const [itineraryRes, optionBlocksRes] = await Promise.all([
        supabase
        .from("itinerary_items")
        .select("id, day_number, title, description, category, start_time, end_time, location, item_date, notes, sort_order, itinerary_id, option_block_id, is_hidden, image_url, thumbnail_url, flight_number, departure_city_code, arrival_city_code, item_price, flight_status")
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

      // Keep raw items/blocks (no date clamping) so the edge function can
      // sanitize per itinerary using each itinerary's own depart/return dates.
      // Exclude items hidden from traveler view.
      const publishedItinerary = ((itineraryRes.data as any[]) || []).filter((i: any) => !i.is_hidden);
      const publishedOptionBlocks = (optionBlocksRes.data as any[]) || [];

      const snapshot = {
        itinerary: publishedItinerary,
        bookings: (bookingsRes.data || []).map((b: any) => ({
          id: b.id,
          confirmation_number: b.confirmation_number,
          status: b.status,
          gross_sales: b.gross_sales,
          total_price: b.total_price,
          supplier_name: b.suppliers?.name || null,
          supplier_type: b.suppliers?.supplier_type || null,
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
        <Button
          variant="outline"
          size="sm"
          asChild
          title="Preview live trip — shows current data including unpublished changes"
        >
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
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-warning border-2 border-background" />
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
                  : "Publish this trip to create a shareable client proposal page."}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Last updated {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
              </p>
            </div>

            {/* ── Readiness checklist ────────────────────────────── */}
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Readiness</p>
                <span className={`text-[11px] font-bold ${
                  allPassed ? "text-success" : passedCount >= 2 ? "text-warning" : "text-destructive"
                }`}>
                  {passedCount}/{readinessChecks.length}
                </span>
              </div>
              {readinessChecks.map((check) => (
                <div key={check.label} className="flex items-start gap-2">
                  {check.passed
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                    : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  }
                  <span className={`text-xs leading-tight ${
                    check.passed ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {check.passed ? check.label : check.detail}
                  </span>
                </div>
              ))}
            </div>

            {/* Blocker warning if critical items missing */}
            {!allPassed && !publishedAt && blockers.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded px-2.5 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
                <span>You can still publish, but completing the checklist gives clients a better experience.</span>
              </div>
            )}

            {hasUnpublishedChanges && publishedAt && (
              <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 rounded px-2 py-1.5">
                <span className="h-2 w-2 rounded-full bg-warning shrink-0" />
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

