import { useState } from "react";
import { ChevronDown, ChevronRight, Lock, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tiers = [
  { name: "Circle", launch: "Now", price: "Free", status: "active" as const },
  { name: "Circle Premier", launch: "Month 12+", price: "$149/year", status: "soon" as const },
  { name: "Founders Society", launch: "Month 18+", price: "$499/year", status: "soon" as const },
];

export function CircleTierRoadmap() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Tier Roadmap</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                "rounded-lg border p-4",
                t.status === "active"
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-muted/30 opacity-70"
              )}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{t.name}</h4>
                {t.status === "soon" && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Launch: {t.launch}</p>
              <p className="text-xs text-muted-foreground">Price: {t.price}</p>
              <Badge
                variant={t.status === "active" ? "default" : "secondary"}
                className="mt-2"
              >
                {t.status === "active" ? "Active" : "Coming Soon"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}