import { useState } from "react";
import {
  INSURANCE_PROVIDERS,
  InsuranceProvider,
  InsuranceTripContext,
  getRecommendedProviders,
} from "@/lib/insuranceProviders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Zap, CheckCircle2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickQuotePanelProps {
  trip: {
    destination?: string;
    depart_date?: string;
    return_date?: string;
    total_trip_cost?: number;
    trip_type?: string;
  };
  travelerCount: number;
  primaryDOB?: string;
  primaryState?: string;
  onSelectProvider: (provider: InsuranceProvider, quoteUrl: string) => void;
}

const COVERAGE_ICONS: Record<string, { label: string; emoji: string }> = {
  includesCancel:  { label: "Trip Cancellation", emoji: "✕" },
  includesMedical: { label: "Medical",           emoji: "+" },
  includesEvac:    { label: "Evacuation",        emoji: "🚁" },
  includesDelay:   { label: "Trip Delay",        emoji: "⏱" },
};

export function QuickQuotePanel({
  trip,
  travelerCount,
  primaryDOB,
  primaryState,
  onSelectProvider,
}: QuickQuotePanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ctx: InsuranceTripContext = {
    destination:   trip.destination || "",
    departDate:    trip.depart_date || "",
    returnDate:    trip.return_date || "",
    tripCost:      trip.total_trip_cost || 0,
    travelerCount,
    primaryDOB,
    primaryState,
  };

  const isInternational = !["US", "USA", "United States"].some(
    s => (trip.destination || "").includes(s)
  );

  const providers = getRecommendedProviders(
    trip.trip_type || "",
    trip.total_trip_cost || 0,
    isInternational,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold text-foreground">Quick Quote</p>
        <span className="text-xs text-muted-foreground">
          — select a provider to open their quote tool pre-filled with trip data
        </span>
      </div>

      {providers.map((provider, idx) => {
        const quoteUrl = provider.quoteUrlBuilder(ctx);
        const isSelected = selectedId === provider.id;
        const isTop = idx === 0;

        return (
          <div
            key={provider.id}
            className={cn(
              "rounded-xl border p-4 transition-all",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                  style={{ background: `${provider.brandColor}18`, border: `1px solid ${provider.brandColor}30` }}
                >
                  {provider.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{provider.shortName}</p>
                    {isTop && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">
                        <Star className="h-2.5 w-2.5 mr-0.5" />Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {provider.strengths[0]}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => {
                    window.open(quoteUrl, "_blank", "noopener,noreferrer");
                    setSelectedId(provider.id);
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Get Quote
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => {
                    window.open(quoteUrl, "_blank", "noopener,noreferrer");
                    onSelectProvider(provider, quoteUrl);
                  }}
                >
                  Add to Trip
                </Button>
              </div>
            </div>

            {/* Plan list */}
            {isSelected && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                {provider.plans.map(plan => (
                  <div key={plan.id} className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {Object.entries(COVERAGE_ICONS).map(([key, { label, emoji }]) => (
                        (plan as any)[key] ? (
                          <span
                            key={key}
                            title={label}
                            className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full"
                          >
                            {emoji} {label}
                          </span>
                        ) : null
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Best for: {provider.plans[0]?.bestFor}
                </p>
              </div>
            )}

            {/* Expand/collapse */}
            <button
              className="text-xs text-primary mt-2 hover:underline"
              onClick={() => setSelectedId(isSelected ? null : provider.id)}
            >
              {isSelected ? "Hide plans" : `View ${provider.plans.length} plan${provider.plans.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
