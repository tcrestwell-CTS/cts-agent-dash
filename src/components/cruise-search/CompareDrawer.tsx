import { Button } from "@/components/ui/button";
import { Ship, X, Scale } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import type { WidgetySailing } from "./types";
import { formatShortDate, formatPrice, getPortPreview } from "./utils";

interface CompareDrawerProps {
  sailings: WidgetySailing[];
  priceCache: Record<string, number | null>;
  onRemove: (ref: string) => void;
  onClear: () => void;
}

export function CompareDrawer({ sailings, priceCache, onRemove, onClear }: CompareDrawerProps) {
  const [open, setOpen] = useState(false);
  if (sailings.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Compare ({sailings.length})
          </span>
          <div className="flex items-center gap-2 flex-1 overflow-x-auto">
            {sailings.map((s) => (
              <div
                key={s.holiday_ref}
                className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md text-xs whitespace-nowrap"
              >
                <Ship className="h-3 w-3 text-primary shrink-0" />
                <span className="max-w-40 truncate">{s.name}</span>
                <button
                  onClick={() => onRemove(s.holiday_ref)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove from compare"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
          <Button size="sm" onClick={() => setOpen(true)} disabled={sailings.length < 2}>
            Compare {sailings.length}
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Cruise Comparison</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-medium">Cruise</th>
                  <th className="text-left py-2 pr-3 font-medium">Line</th>
                  <th className="text-left py-2 pr-3 font-medium">Ship</th>
                  <th className="text-left py-2 pr-3 font-medium">Departs</th>
                  <th className="text-left py-2 pr-3 font-medium">Nights</th>
                  <th className="text-left py-2 pr-3 font-medium">Route</th>
                  <th className="text-right py-2 pl-3 font-medium">From / pp</th>
                </tr>
              </thead>
              <tbody>
                {sailings.map((s) => (
                  <tr key={s.holiday_ref} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-medium max-w-48">
                      <div className="line-clamp-2">{s.name}</div>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{s.operator_title}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{s.ship_title || "—"}</td>
                    <td className="py-3 pr-3">{formatShortDate(s.date_from)}</td>
                    <td className="py-3 pr-3">{s.nights || "—"}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{getPortPreview(s) || "—"}</td>
                    <td className="py-3 pl-3 text-right font-semibold text-primary">
                      {formatPrice(priceCache[s.holiday_ref])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}