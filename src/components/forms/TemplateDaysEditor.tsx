import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, CalendarDays, Plus, Trash2 } from "lucide-react";
import { ImageUploadField } from "@/components/shared/ImageUploadField";

export interface TemplateDayItem {
  day_number: number;
  title: string;
  category: string;
  description?: string | null;
  location?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  item_price?: number | null;
  sort_order?: number | null;
  image_url?: string | null;
}

const CATEGORIES = [
  "activity",
  "flight",
  "hotel",
  "cruise",
  "transfer",
  "dining",
  "excursion",
  "note",
];

interface Props {
  items: TemplateDayItem[];
  onChange: (items: TemplateDayItem[]) => void;
}

/** Tern-style day-by-day builder for itinerary templates. */
export function TemplateDaysEditor({ items, onChange }: Props) {
  const normalize = (list: TemplateDayItem[]) =>
    [...list]
      .sort(
        (a, b) =>
          a.day_number - b.day_number || (a.sort_order ?? 0) - (b.sort_order ?? 0),
      )
      .map((item, idx) => ({ ...item, sort_order: idx }));

  const days = Array.from(new Set(items.map((i) => i.day_number))).sort((a, b) => a - b);
  const maxDay = days.length ? days[days.length - 1] : 0;
  const total = items.reduce((sum, i) => sum + (Number(i.item_price) || 0), 0);

  const patch = (index: number, changes: Partial<TemplateDayItem>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...changes } : item));
    onChange(next);
  };

  const addItem = (day: number) => {
    onChange(
      normalize([
        ...items,
        { day_number: day, title: "", category: "activity", sort_order: items.length },
      ]),
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const item = items[index];
    const sameDay = items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => it.day_number === item.day_number);
    const pos = sameDay.findIndex(({ i }) => i === index);
    const swap = sameDay[pos + dir];
    if (!swap) return;
    const next = [...items];
    next[index] = swap.it;
    next[swap.i] = item;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" /> Day-by-day plan
        </Label>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <Badge variant="secondary">
              Est. ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Badge>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => addItem(maxDay + 1)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add day
          </Button>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No days yet. Add day 1 to start building this template.
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <Fragment key={day}>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Day {day}</p>
                  <Button type="button" size="sm" variant="ghost" onClick={() => addItem(day)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map((item, index) =>
                    item.day_number !== day ? null : (
                      <div key={index} className="space-y-2 rounded-md border bg-card p-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Item title (e.g. Board the ship)"
                            value={item.title}
                            onChange={(e) => patch(index, { title: e.target.value })}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 shrink-0"
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 shrink-0"
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 shrink-0 text-destructive"
                            onClick={() => onChange(normalize(items.filter((_, i) => i !== index)))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-4">
                          <Select
                            value={item.category || "activity"}
                            onValueChange={(v) => patch(index, { category: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c} className="capitalize">
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Location"
                            value={item.location ?? ""}
                            onChange={(e) => patch(index, { location: e.target.value })}
                          />
                          <Input
                            type="time"
                            value={item.start_time ?? ""}
                            onChange={(e) => patch(index, { start_time: e.target.value })}
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Price"
                            value={item.item_price ?? ""}
                            onChange={(e) =>
                              patch(index, {
                                item_price: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <Textarea
                          rows={2}
                          placeholder="Details clients will see…"
                          value={item.description ?? ""}
                          onChange={(e) => patch(index, { description: e.target.value })}
                        />
                        <ImageUploadField
                          label="Image"
                          value={item.image_url ?? ""}
                          onChange={(url) => patch(index, { image_url: url || null })}
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}