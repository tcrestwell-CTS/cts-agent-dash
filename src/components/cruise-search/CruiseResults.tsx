import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Ship, RotateCcw } from "lucide-react";
import { CruiseCard } from "./CruiseCard";
import { CruiseLoadingState } from "./CruiseLoadingState";
import type { WidgetySailing, SortOption } from "./types";

interface CruiseResultsProps {
  sailings: WidgetySailing[];
  totalResults: number;
  loading: boolean;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
  comparingRefs: string[];
  onToggleCompare: (ref: string) => void;
  onViewDetails: (s: WidgetySailing) => void;
  onRequestQuote: (s: WidgetySailing) => void;
  onResetFilters?: () => void;
}

export function CruiseResults({
  sailings,
  totalResults,
  loading,
  sort,
  onSortChange,
  comparingRefs,
  onToggleCompare,
  onViewDetails,
  onRequestQuote,
  onResetFilters,
}: CruiseResultsProps) {
  return (
    <div className="space-y-4">
      {/* Header / sort row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {loading ? "Searching…" : `${totalResults.toLocaleString()} cruises found`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <Select value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">Recommended</SelectItem>
              <SelectItem value="date_asc">Departure Date</SelectItem>
              <SelectItem value="duration_asc">Duration</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <CruiseLoadingState />
      ) : sailings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-card">
          <Ship className="h-14 w-14 text-muted-foreground/30 mb-3" />
          <h3 className="font-semibold text-lg">No cruises match your filters</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            Try adjusting or resetting your filters to see more results.
          </p>
          {onResetFilters && (
            <Button variant="outline" onClick={onResetFilters} className="mt-4">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sailings.map((s) => (
            <CruiseCard
              key={s.holiday_ref}
              sailing={s}
              isComparing={comparingRefs.includes(s.holiday_ref)}
              onToggleCompare={onToggleCompare}
              onViewDetails={onViewDetails}
              onRequestQuote={onRequestQuote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
