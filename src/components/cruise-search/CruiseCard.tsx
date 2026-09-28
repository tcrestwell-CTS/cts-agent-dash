import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Ship, Calendar, MapPin, ChevronDown, ChevronUp, Eye, Plus } from "lucide-react";
import type { WidgetySailing } from "./types";
import { formatShortDate, formatPrice, getPortPreview, getAudienceTags, getCruiseType, operatorSlugFromTitle, getShipTitle } from "./utils";
import { cn } from "@/lib/utils";

interface CruiseCardProps {
  sailing: WidgetySailing;
  price?: number | null;
  isComparing?: boolean;
  onToggleCompare?: (ref: string) => void;
  onViewDetails?: (s: WidgetySailing) => void;
  onSelect?: (s: WidgetySailing) => void;
}

export function CruiseCard({
  sailing,
  price,
  isComparing,
  onToggleCompare,
  onViewDetails,
  onSelect,
}: CruiseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const operatorSlug = operatorSlugFromTitle(sailing.operator_title);
  const tags = getAudienceTags(operatorSlug);
  const type = getCruiseType(operatorSlug);
  const portPreview = getPortPreview(sailing);
  const shipTitle = getShipTitle(sailing);
  const cabinFares = Array.from(
    new Map(
      (sailing.fares || [])
        .filter((fare) => fare.available && typeof fare.price_amount === "number")
        .map((fare) => [fare.cabin_class.trim().toLowerCase(), fare]),
    ).values(),
  ).slice(0, 4);

  return (
    <Card className={cn(
      "overflow-hidden transition-all hover:shadow-md",
      isComparing && "ring-2 ring-primary"
    )}>
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        <div className="relative h-48 sm:h-auto sm:w-64 shrink-0 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
          {sailing.image_url ? (
            <img
              src={sailing.image_url}
              alt={sailing.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Ship className="h-16 w-16 text-primary/20" />
            </div>
          )}
          {sailing.nights && (
            <Badge className="absolute top-2 left-2 bg-background/95 text-foreground hover:bg-background">
              {sailing.nights} Nights
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-5 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                {sailing.operator_title}
              </p>
              <h3 className="font-semibold text-base leading-snug line-clamp-2 mt-0.5">
                {sailing.name}
              </h3>
              {shipTitle && (
                <p className="text-sm text-muted-foreground italic mt-0.5 flex items-center gap-1">
                  <Ship className="h-3.5 w-3.5" />
                  {shipTitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-3">
            {sailing.date_from && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatShortDate(sailing.date_from)}
                {sailing.date_to && ` – ${formatShortDate(sailing.date_to)}`}
              </span>
            )}
            {portPreview && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {portPreview}
              </span>
            )}
          </div>

          {/* Tags */}
          {(tags.length > 0 || type === "river") && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {type === "river" && (
                <Badge variant="secondary" className="text-[10px]">River Cruise</Badge>
              )}
              {tags.includes("family") && (
                <Badge variant="secondary" className="text-[10px]">Family Friendly</Badge>
              )}
              {tags.includes("luxury") && (
                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Luxury</Badge>
              )}
              {tags.includes("adults") && (
                <Badge variant="secondary" className="text-[10px]">Adults Only</Badge>
              )}
            </div>
          )}

          {cabinFares.length > 0 && (
            <div className="mb-4 border-y py-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Cabin fares per person</p>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 md:grid-cols-4">
                {cabinFares.map((fare) => (
                  <button
                    key={`${fare.cabin_class}-${fare.price_amount}`}
                    type="button"
                    onClick={() => onViewDetails?.(sailing)}
                    className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`View ${fare.cabin_class} fare details`}
                  >
                    <span className="block truncate text-xs text-muted-foreground">{fare.cabin_class}</span>
                    <span className="block text-sm font-semibold text-primary">
                      {formatPrice(fare.price_amount as number)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer row */}
          <div className="flex items-end justify-between mt-auto gap-3 flex-wrap">
            <div>
              {price != null ? (
                <>
                  <p className="text-xs text-muted-foreground">From</p>
                  <p className="text-2xl font-bold text-primary leading-none">
                    {formatPrice(price)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">/ pp</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Taxes &amp; fees additional
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">Pricing on request</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onToggleCompare && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={isComparing}
                    onCheckedChange={() => onToggleCompare(sailing.holiday_ref)}
                  />
                  Compare
                </label>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails?.(sailing)}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                View Details
              </Button>
              <Button
                size="sm"
                onClick={() => onSelect?.(sailing)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Select
              </Button>
            </div>
          </div>

          {sailing.description && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-xs text-primary mt-3 hover:underline self-start"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide" : "Show"} description
            </button>
          )}
          {expanded && sailing.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-4">
              {sailing.description}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}