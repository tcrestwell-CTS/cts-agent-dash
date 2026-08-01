import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";
import type { ItineraryItem } from "@/hooks/useItinerary";

interface Props {
  items: ItineraryItem[];
  className?: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/**
 * Rolls up per-item prices on the itinerary into a category breakdown and total.
 * Presentation only — the margin engine remains the source of truth for trip financials.
 */
export function ItineraryPricingSummary({ items, className }: Props) {
  const priced = items.filter((i) => Number((i as any).item_price) > 0);
  if (priced.length === 0) return null;

  const byCategory = priced.reduce<Record<string, number>>((acc, item) => {
    const amount = Number((i2 = item, (i2 as any).item_price)) || 0;
    acc[item.category] = (acc[item.category] || 0) + amount;
    return acc;
  }, {});
  let i2: ItineraryItem;

  const total = Object.values(byCategory).reduce((sum, v) => sum + v, 0);
  const unpriced = items.length - priced.length;

  return (
    <Card className={className}>
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">Itinerary pricing</p>
              <p className="text-xs text-muted-foreground">
                {priced.length} priced item{priced.length === 1 ? "" : "s"}
                {unpriced > 0 ? ` · ${unpriced} without a price` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-card-foreground">{fmt(total)}</p>
            <p className="text-[11px] text-muted-foreground">Itinerary component total</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([category, amount]) => (
              <Badge key={category} variant="outline" className="text-[11px] capitalize font-normal">
                {category}: {fmt(amount)}
              </Badge>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
