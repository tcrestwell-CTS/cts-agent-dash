/**
 * ItineraryItemEditor — Advanced full-screen tabbed editor for itinerary items.
 *
 * Replaces the basic EditItineraryItemDialog with a Tern-style 4-tab sheet:
 *   1. Details         — title, category, location, times, description, notes
 *   2. Booking & Pricing — supplier, confirmation #, price, commission, status
 *   3. Media           — photo URL, thumbnail, custom image for proposal
 *   4. Flight Status   — live status badge (for flight category only)
 *
 * This is rendered as a Sheet (slide-over) so it doesn't block the itinerary canvas.
 */

import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // kept for notes field
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plane, Hotel, Ship, Car, UtensilsCrossed, Camera, Target, Heart,
  ShoppingBag, Music, Loader2, CheckCircle2, AlertTriangle, XCircle,
  Clock, ExternalLink, ImageIcon, DollarSign, FileText, Info, EyeOff, Eye as EyeOn,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { type ItineraryItem } from "@/hooks/useItinerary";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ImageUploadField } from "@/components/shared/ImageUploadField";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: "flight",         label: "Flight",         icon: Plane,           emoji: "✈️" },
  { value: "hotel",          label: "Hotel",          icon: Hotel,           emoji: "🏨" },
  { value: "cruise",         label: "Cruise",         icon: Ship,            emoji: "🚢" },
  { value: "transportation", label: "Transportation", icon: Car,             emoji: "🚗" },
  { value: "dining",         label: "Dining",         icon: UtensilsCrossed, emoji: "🍽️" },
  { value: "activity",       label: "Activity",       icon: Target,          emoji: "🎯" },
  { value: "sightseeing",    label: "Sightseeing",    icon: Camera,          emoji: "📸" },
  { value: "relaxation",     label: "Relaxation",     icon: Heart,           emoji: "🧘" },
  { value: "shopping",       label: "Shopping",       icon: ShoppingBag,     emoji: "🛍️" },
  { value: "entertainment",  label: "Entertainment",  icon: Music,           emoji: "🎭" },
];

const BOOKING_STATUSES = [
  { value: "pending",    label: "Pending",    color: "text-warning" },
  { value: "confirmed",  label: "Confirmed",  color: "text-success" },
  { value: "cancelled",  label: "Cancelled",  color: "text-destructive" },
  { value: "waitlisted", label: "Waitlisted", color: "text-primary" },
];

const FLIGHT_STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  confirmed:        { label: "On Time / Confirmed",  icon: CheckCircle2, className: "text-success bg-success/10 border-success/30" },
  schedule_changed: { label: "Schedule Changed",      icon: AlertTriangle, className: "text-warning bg-warning/10 border-warning/30" },
  cancelled:        { label: "Cancelled",             icon: XCircle,       className: "text-destructive bg-destructive/10 border-destructive/30" },
  pending:          { label: "Awaiting Status",        icon: Clock,         className: "text-muted-foreground bg-muted border-border" },
};

interface ExtendedItem extends ItineraryItem {
  flight_number?: string | null;
  departure_city_code?: string | null;
  arrival_city_code?: string | null;
  item_price?: number | null;
  // Booking & pricing
  supplier_name?: string | null;
  confirmation_number?: string | null;
  booking_status?: string | null;
  supplier_cost?: number | null;
  commission_amount?: number | null;
  // Media
  image_url?: string | null;
  thumbnail_url?: string | null;
  gallery_urls?: string[] | null;
  // Flight status
  flight_status?: string | null;
  flight_status_updated_at?: string | null;
  // Visibility
  is_hidden?: boolean | null;
}

interface Props {
  item: ExtendedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (itemId: string, data: Partial<ExtendedItem>) => Promise<boolean>;
}

// ── Tab: Details ──────────────────────────────────────────────────────────────
function DetailsTab({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const isFlight = form.category === "flight";

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Title *</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Check-in at resort"
          />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{form.category === "hotel" ? "Property Name" : "Location / Venue"}</Label>
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder={form.category === "hotel" ? "Marriott Bonvoy, Cancun" : "Place name or address"}
          />
        </div>
        <div>
          <Label>Start Time</Label>
          <Input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
        </div>
        <div>
          <Label>End Time</Label>
          <Input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          />
        </div>
      </div>

      {isFlight && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
            <Plane className="h-3 w-3" /> Flight Details
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Flight Number</Label>
              <Input
                value={form.flight_number}
                onChange={(e) => setForm({ ...form, flight_number: e.target.value })}
                placeholder="AA 1234"
              />
            </div>
            <div>
              <Label>Departs (IATA)</Label>
              <Input
                value={form.departure_city_code}
                onChange={(e) => setForm({ ...form, departure_city_code: e.target.value.toUpperCase() })}
                placeholder="JFK"
                maxLength={4}
                className="uppercase"
              />
            </div>
            <div>
              <Label>Arrives (IATA)</Label>
              <Input
                value={form.arrival_city_code}
                onChange={(e) => setForm({ ...form, arrival_city_code: e.target.value.toUpperCase() })}
                placeholder="LAX"
                maxLength={4}
                className="uppercase"
              />
            </div>
          </div>
        </>
      )}

      <Separator />

      <div>
        <Label>Client-Facing Description</Label>
        <RichTextEditor
          value={form.description}
          onChange={(html) => setForm({ ...form, description: html })}
          placeholder="Shown to the client in the trip proposal and portal — supports bold, italics, bullets, and links"
          minHeight={90}
        />
      </div>
      <div>
        <Label>Internal Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Agent-only notes — not shown to client"
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
        <div className="flex items-center gap-2">
          {form.is_hidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <EyeOn className="h-4 w-4 text-muted-foreground" />}
          <div>
            <p className="text-sm font-medium">Hide from traveler</p>
            <p className="text-xs text-muted-foreground">Activity stays visible to you but is hidden on the client-facing proposal</p>
          </div>
        </div>
        <Switch
          checked={!!form.is_hidden}
          onCheckedChange={(v) => setForm({ ...form, is_hidden: v })}
          data-testid="switch-hide-activity"
        />
      </div>
    </div>
  );
}

// ── Tab: Booking & Pricing ────────────────────────────────────────────────────
function BookingPricingTab({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const margin =
    form.item_price && form.supplier_cost
      ? ((parseFloat(form.item_price) - parseFloat(form.supplier_cost)) / parseFloat(form.item_price) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-4 py-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
        <FileText className="h-3 w-3" /> Booking Info
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Supplier Name</Label>
          <Input
            value={form.supplier_name}
            onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
            placeholder="e.g., Hotelbeds, Delta, NCL"
          />
        </div>
        <div>
          <Label>Confirmation Number</Label>
          <Input
            value={form.confirmation_number}
            onChange={(e) => setForm({ ...form, confirmation_number: e.target.value })}
            placeholder="e.g., 7X4R2K"
          />
        </div>
        <div className="col-span-2">
          <Label>Booking Status</Label>
          <Select value={form.booking_status} onValueChange={(v) => setForm({ ...form, booking_status: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {BOOKING_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <span className={s.color}>{s.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
        <DollarSign className="h-3 w-3" /> Pricing
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Client Price</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.item_price}
            onChange={(e) => setForm({ ...form, item_price: e.target.value })}
            placeholder="0.00"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Shown to client in proposal</p>
        </div>
        <div>
          <Label>Supplier Cost</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.supplier_cost}
            onChange={(e) => setForm({ ...form, supplier_cost: e.target.value })}
            placeholder="0.00"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Your net cost (internal)</p>
        </div>
        <div>
          <Label>Commission / Margin</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.commission_amount}
            onChange={(e) => setForm({ ...form, commission_amount: e.target.value })}
            placeholder="0.00"
          />
        </div>
        {margin !== null && (
          <div className="flex items-end pb-1">
            <div className="rounded-md bg-success/10 dark:bg-success/30 border border-success/30 dark:border-success px-3 py-2 w-full text-center">
              <p className="text-[10px] text-muted-foreground">Gross Margin</p>
              <p className="text-lg font-bold text-success dark:text-success">{margin}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Media ────────────────────────────────────────────────────────────────
function MediaTab({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div className="space-y-4 py-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
        <ImageIcon className="h-3 w-3" /> Proposal Images
      </p>
      <div className="space-y-3">
        <ImageUploadField
          label="Main Image"
          value={form.image_url || ""}
          onChange={(url) => setForm({ ...form, image_url: url })}
          hint="Shown as the hero image for this activity in the client proposal"
        />
        <ImageUploadField
          label="Thumbnail"
          value={form.thumbnail_url || ""}
          onChange={(url) => setForm({ ...form, thumbnail_url: url })}
          compact
          hint="Smaller/square image used in list views"
        />
        <GalleryUploadField
          label="Additional Photos"
          value={Array.isArray(form.gallery_urls) ? form.gallery_urls : []}
          onChange={(urls) => setForm({ ...form, gallery_urls: urls })}
          hint="Extra photos shown as a swipeable gallery in the client portal"
        />
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground mb-1">
          <Info className="h-3.5 w-3.5" /> Image Sources
        </p>
        <ul className="space-y-0.5">
          <li>• Use Unsplash: <span className="font-mono">https://unsplash.com/photos/[id]</span></li>
          <li>• Use your Supabase Storage bucket for uploaded assets</li>
          <li>• Supplier portals (cruise lines, hotels) often have press photo libraries</li>
        </ul>
      </div>
    </div>
  );
}

// ── Tab: Flight Status ────────────────────────────────────────────────────────
function FlightStatusTab({ item, form }: { item: ExtendedItem; form: any }) {
  const status = item.flight_status || "pending";
  const config = FLIGHT_STATUS_CONFIG[status] || FLIGHT_STATUS_CONFIG.pending;
  const Icon = config.icon;
  const flightNum = form.flight_number;
  const dep = form.departure_city_code;
  const arr = form.arrival_city_code;

  return (
    <div className="space-y-4 py-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
        <Plane className="h-3 w-3" /> Live Flight Status
      </p>

      {(!flightNum && !dep) ? (
        <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground text-center">
          Add a flight number and route in the Details tab to enable status monitoring.
        </div>
      ) : (
        <>
          <div className={`rounded-lg border p-4 ${config.className}`}>
            <div className="flex items-center gap-3">
              <Icon className="h-6 w-6 flex-shrink-0" />
              <div>
                <p className="font-semibold">{config.label}</p>
                {item.flight_status_updated_at && (
                  <p className="text-xs opacity-70 mt-0.5">
                    Last checked: {new Date(item.flight_status_updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <div className="text-center flex-1">
              <p className="text-lg font-bold">{dep || "—"}</p>
              <p className="text-xs text-muted-foreground">Departure</p>
            </div>
            <div className="flex-shrink-0 text-muted-foreground">
              <Plane className="h-4 w-4" />
            </div>
            <div className="text-center flex-1">
              <p className="text-lg font-bold">{arr || "—"}</p>
              <p className="text-xs text-muted-foreground">Arrival</p>
            </div>
          </div>

          {flightNum && (
            <a
              href={`https://www.flightaware.com/live/flight/${flightNum.replace(/\s/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Track on FlightAware
            </a>
          )}

          <div className="text-xs text-muted-foreground rounded-md bg-muted/50 p-3">
            Status is updated via your flight monitoring dashboard. Within 72h of departure,
            Duffel provides real-time alerts for delays and cancellations.
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────────
export function ItineraryItemEditor({ item, open, onOpenChange, onUpdate }: Props) {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const [form, setForm] = useState<any>({});

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setForm({
        title: item.title || "",
        description: item.description || "",
        category: item.category || "activity",
        location: item.location || "",
        start_time: item.start_time || "",
        end_time: item.end_time || "",
        notes: item.notes || "",
        flight_number: item.flight_number || "",
        departure_city_code: item.departure_city_code || "",
        arrival_city_code: item.arrival_city_code || "",
        item_price: item.item_price != null ? String(item.item_price) : "",
        supplier_name: item.supplier_name || "",
        confirmation_number: item.confirmation_number || "",
        booking_status: item.booking_status || "",
        supplier_cost: item.supplier_cost != null ? String(item.supplier_cost) : "",
        commission_amount: item.commission_amount != null ? String(item.commission_amount) : "",
        image_url: item.image_url || "",
        thumbnail_url: item.thumbnail_url || "",
        gallery_urls: Array.isArray((item as any).gallery_urls) ? (item as any).gallery_urls : [],
      });
    }
  }, [item]);

  if (!item) return null;

  const isFlight = form.category === "flight";
  const catConfig = CATEGORIES.find((c) => c.value === form.category) || CATEGORIES[5];
  const CatIcon = catConfig.icon;

  const handleSave = async () => {
    if (!form.title?.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const success = await onUpdate(item.id, {
        title: form.title,
        description: form.description || null,
        category: form.category,
        location: form.location || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        notes: form.notes || null,
        flight_number: form.flight_number || null,
        departure_city_code: form.departure_city_code || null,
        arrival_city_code: form.arrival_city_code || null,
        item_price: form.item_price ? parseFloat(form.item_price) : null,
        // Extended fields (stored as JSON metadata or separate columns depending on schema)
        supplier_name: form.supplier_name || null,
        confirmation_number: form.confirmation_number || null,
        booking_status: form.booking_status || null,
        supplier_cost: form.supplier_cost ? parseFloat(form.supplier_cost) : null,
        commission_amount: form.commission_amount ? parseFloat(form.commission_amount) : null,
        image_url: form.image_url || null,
        thumbnail_url: form.thumbnail_url || null,
        gallery_urls: (Array.isArray(form.gallery_urls) ? form.gallery_urls : []).filter((u: string) => u && u.trim()),
        is_hidden: form.is_hidden ?? false,
      } as any);
      if (success) {
        toast.success("Activity saved");
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] p-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CatIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate">{form.title || "Itinerary Item"}</p>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                {catConfig.emoji} {catConfig.label}
                {form.location ? ` · ${form.location}` : ""}
              </p>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="w-full rounded-none border-b bg-transparent px-6 justify-start gap-1 h-10 flex-shrink-0">
            <TabsTrigger value="details" className="text-xs h-8 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Details
            </TabsTrigger>
            <TabsTrigger value="booking" className="text-xs h-8 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Booking & Pricing
            </TabsTrigger>
            <TabsTrigger value="media" className="text-xs h-8 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Media
            </TabsTrigger>
            {isFlight && (
              <TabsTrigger value="flight" className="text-xs h-8 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Flight Status
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6">
            <TabsContent value="details" className="mt-0 border-0">
              <DetailsTab form={form} setForm={setForm} />
            </TabsContent>

            <TabsContent value="booking" className="mt-0 border-0">
              <BookingPricingTab form={form} setForm={setForm} />
            </TabsContent>

            <TabsContent value="media" className="mt-0 border-0">
              <MediaTab form={form} setForm={setForm} />
            </TabsContent>

            {isFlight && (
              <TabsContent value="flight" className="mt-0 border-0">
                <FlightStatusTab item={item} form={form} />
              </TabsContent>
            )}
          </div>
        </Tabs>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex-shrink-0 flex items-center justify-between gap-3 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.title?.trim()} className="min-w-[100px]">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
