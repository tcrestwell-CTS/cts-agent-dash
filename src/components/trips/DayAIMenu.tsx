import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { aiDayItems, type AISuggestedItem } from "@/lib/itineraryAI";

interface Props {
  dayNumber: number;
  date?: string | null;
  destination?: string | null;
  tripName?: string | null;
  dayItems: { title: string; start_time?: string | null; location?: string | null; sort_order?: number }[];
  /** Inserts the chosen items; resolves true on success. */
  onAddItems: (items: AISuggestedItem[]) => Promise<boolean>;
}

export function DayAIMenu({ dayNumber, date, destination, tripName, dayItems, onAddItems }: Props) {
  const [mode, setMode] = useState<"suggest" | "fill_day" | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [results, setResults] = useState<AISuggestedItem[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const run = async (m: "suggest" | "fill_day") => {
    setMode(m);
    setLoading(true);
    setResults([]);
    try {
      const items = await aiDayItems(m, { destination, tripName, dayNumber, date, dayItems, instructions: notes || undefined });
      setResults(items);
      setPicked(new Set(items.map((_, i) => i)));
      if (!items.length) toast.error("No suggestions came back — try adding a note for the AI");
    } catch (e: any) {
      toast.error(e.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const add = async () => {
    const chosen = results.filter((_, i) => picked.has(i));
    if (!chosen.length) return;
    setAdding(true);
    const ok = await onAddItems(chosen);
    setAdding(false);
    if (ok) { setMode(null); setResults([]); setNotes(""); }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2" aria-label={`AI actions for day ${dayNumber}`}>
            <Sparkles className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => run("suggest")}>Suggest activities</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run("fill_day")}>Fill this day</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!mode} onOpenChange={(o) => { if (!o && !adding) { setMode(null); setResults([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === "fill_day" ? `Fill day ${dayNumber}` : `Activity ideas for day ${dayNumber}`}</DialogTitle>
            <DialogDescription>Review the suggestions and pick the ones to add. Nothing is added until you confirm.</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {results.map((r, i) => (
                <label key={i} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                  <Checkbox
                    checked={picked.has(i)}
                    onCheckedChange={(v) => {
                      const next = new Set(picked);
                      v ? next.add(i) : next.delete(i);
                      setPicked(next);
                    }}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {r.start_time && <span className="text-muted-foreground mr-1.5">{r.start_time}</span>}
                      {r.title}
                    </p>
                    {r.location && <p className="text-xs text-muted-foreground">{r.location} · {r.category}</p>}
                    {r.description && <p className="text-xs mt-1">{r.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional guidance, e.g. 'slow morning, kid-friendly, beach afternoon'"
              className="text-sm min-h-[56px]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={loading || adding} onClick={() => mode && run(mode)}>
              Try again
            </Button>
            <Button disabled={loading || adding || picked.size === 0} onClick={add}>
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add {picked.size || ""} to day {dayNumber}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
