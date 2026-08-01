import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LibraryBig, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useLibraryTemplates, type LibraryTemplate } from "@/hooks/useLibraryTemplates";
import type { ItineraryItem } from "@/hooks/useItinerary";

interface Props {
  tripId: string;
  tripName: string;
  destination: string | null;
  items: ItineraryItem[];
  totalDays: number;
  onAdd: (data: any) => Promise<boolean>;
  variant?: "button" | "sidebar";
}

interface TemplateItem {
  day_number: number;
  title: string;
  category: string;
  description?: string | null;
  location?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  item_price?: number | null;
  sort_order?: number | null;
}

/** Save the current itinerary to the shared library, or apply a saved template to this trip. */
export function ItineraryTemplateDialog({
  tripId, tripName, destination, items, totalDays, onAdd, variant = "button",
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"apply" | "save">("apply");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const { data: templates = [], isLoading, create, markUsed } = useLibraryTemplates("itinerary");

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Give the template a name.");
      return;
    }
    if (items.length === 0) {
      toast.error("This itinerary has no items to save.");
      return;
    }
    setSaving(true);
    const templateItems: TemplateItem[] = items.map((item, idx) => ({
      day_number: item.day_number,
      title: item.title,
      category: item.category,
      description: item.description,
      location: item.location,
      start_time: item.start_time,
      end_time: item.end_time,
      item_price: (item as any).item_price ?? null,
      sort_order: item.sort_order ?? idx,
    }));
    try {
      await create.mutateAsync({
        kind: "itinerary",
        name: name.trim(),
        description: description.trim() || `Saved from ${tripName}`,
        destination: destination || null,
        duration_days: totalDays,
        template_data: { items: templateItems },
        is_shared: true,
      } as any);
      setName("");
      setDescription("");
      setTab("apply");
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async (tpl: LibraryTemplate) => {
    const templateItems = (tpl.template_data as any)?.items as TemplateItem[] | undefined;
    if (!templateItems?.length) {
      toast.error("That template has no itinerary items saved.");
      return;
    }
    setApplyingId(tpl.id);
    let added = 0;
    for (const item of templateItems) {
      const ok = await onAdd({
        trip_id: tripId,
        day_number: Math.max(1, item.day_number || 1),
        title: item.title,
        category: item.category || "activity",
        description: item.description || undefined,
        location: item.location || undefined,
        start_time: item.start_time || undefined,
        end_time: item.end_time || undefined,
        item_price: item.item_price ?? undefined,
        sort_order: item.sort_order ?? undefined,
      });
      if (ok) added++;
    }
    setApplyingId(null);
    if (added > 0) {
      markUsed.mutate(tpl);
      toast.success(`Applied ${added} item${added === 1 ? "" : "s"} from "${tpl.name}".`);
      setOpen(false);
    } else {
      toast.error("Nothing could be applied.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "sidebar" ? (
          <button className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors text-foreground">
            <LibraryBig className="h-4 w-4 text-primary" />
            <span>Itinerary Templates</span>
          </button>
        ) : (
          <Button variant="outline" size="sm">
            <LibraryBig className="h-4 w-4 mr-2" /> Templates
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LibraryBig className="h-5 w-5 text-primary" /> Itinerary Templates
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "apply" | "save")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="apply">Apply a template</TabsTrigger>
            <TabsTrigger value="save">Save this itinerary</TabsTrigger>
          </TabsList>

          <TabsContent value="apply" className="pt-4">
            <ScrollArea className="max-h-[50vh] pr-3">
              <div className="space-y-2">
                {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>}
                {!isLoading && templates.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No itinerary templates yet. Save this itinerary to start the library.
                  </p>
                )}
                {templates.map((tpl) => {
                  const count = ((tpl.template_data as any)?.items?.length ?? 0) as number;
                  return (
                    <div
                      key={tpl.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm text-card-foreground">{tpl.name}</span>
                          {tpl.destination && (
                            <Badge variant="outline" className="text-[10px]">{tpl.destination}</Badge>
                          )}
                          {tpl.duration_days ? (
                            <Badge variant="secondary" className="text-[10px]">{tpl.duration_days} days</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {tpl.description || "No description"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {count} item{count === 1 ? "" : "s"} · used {tpl.usage_count ?? 0}×
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={applyingId !== null || count === 0}
                        onClick={() => handleApply(tpl)}
                      >
                        {applyingId === tpl.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Apply
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="save" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Saves all {items.length} current itinerary item{items.length === 1 ? "" : "s"} — days,
              times, categories and prices — as a reusable template in the shared library.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Template name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 7-Night Western Caribbean"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="When to use this template..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || items.length === 0}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save template
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
