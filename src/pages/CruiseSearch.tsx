import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { CruiseSearchHeader } from "@/components/cruise-search/CruiseSearchHeader";
import { SearchBar, type SearchBarValues } from "@/components/cruise-search/SearchBar";
import { FilterSidebar } from "@/components/cruise-search/FilterSidebar";
import { CruiseResults } from "@/components/cruise-search/CruiseResults";
import { CompareDrawer } from "@/components/cruise-search/CompareDrawer";
import { CruiseDetailsModal } from "@/components/cruise-search/CruiseDetailsModal";
import {
  AVAILABLE_DESTINATIONS,
  DEFAULT_FILTERS,
  type CruiseFilterState,
  type SortOption,
  type WidgetySailing,
} from "@/components/cruise-search/types";
import {
  getAudienceTags,
  getCruiseType,
  getMonthKey,
  operatorSlugFromTitle,
} from "@/components/cruise-search/utils";

const DEFAULT_SEARCH: SearchBarValues = {
  destination: "",
  cruiseLine: "",
  ship: "",
  dateFrom: "",
  dateTo: "",
  lengthPreset: "any",
  departurePort: "",
  travelers: "2",
};

export default function CruiseSearch() {
  const [searchValues, setSearchValues] = useState<SearchBarValues>(DEFAULT_SEARCH);
  const [filters, setFilters] = useState<CruiseFilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortOption>("recommended");

  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sailings, setSailings] = useState<WidgetySailing[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [priceCache, setPriceCache] = useState<Record<string, number | null>>({});
  const [comparingRefs, setComparingRefs] = useState<string[]>([]);

  const [availableShips, setAvailableShips] = useState<{ title: string; slug: string }[]>([]);
  const [shipsLoading, setShipsLoading] = useState(false);

  const [detailsSailing, setDetailsSailing] = useState<WidgetySailing | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Date helpers (now driven directly by date-range calendar)
  const dateFrom = searchValues.dateFrom || "";
  const dateTo = searchValues.dateTo || "";

  // Map length preset → duration range for live filtering
  const LENGTH_RANGES: Record<string, [number, number]> = {
    any: [1, 30],
    "1-3": [1, 3],
    "4-6": [4, 6],
    "7-9": [7, 9],
    "10-14": [10, 14],
    "15+": [15, 30],
  };

  const handleSearchValuesChange = (next: SearchBarValues) => {
    if (next.lengthPreset !== searchValues.lengthPreset) {
      const range = LENGTH_RANGES[next.lengthPreset] ?? [1, 30];
      setFilters((f) => ({ ...f, durationRange: range }));
    }
    setSearchValues(next);
  };

  // Cascade ships when cruise line changes
  useEffect(() => {
    if (!searchValues.cruiseLine || searchValues.cruiseLine === "all") {
      setAvailableShips([]);
      return;
    }
    let cancelled = false;
    setShipsLoading(true);
    supabase.functions
      .invoke("widgety-cruise", { body: { action: "ships", operator: searchValues.cruiseLine } })
      .then(({ data, error }) => {
        if (cancelled || error || data?.error) return;
        const list = (data.ships || [])
          .map((s: any) => {
            const href = s?.href || s?.ship || s?.url || s?._links?.self?.href;
            const slug =
              typeof href === "string"
                ? href.match(/\/ships\/([^.\/?]+)\.json/i)?.[1] || s.slug || ""
                : s.slug || "";
            return { title: s.title || s.name || "", slug };
          })
          .filter((s: any) => s.title && s.slug);
        const unique = Array.from(new Map(list.map((s: any) => [s.slug, s])).values()) as { title: string; slug: string }[];
        setAvailableShips(unique);
      })
      .catch(() => {})
      .finally(() => !cancelled && setShipsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [searchValues.cruiseLine]);

  const handleSearch = async () => {
    if (dateFrom && dateTo && dateTo < dateFrom) {
      toast.error("'To' date cannot be before 'From' date.");
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const params: Record<string, any> = { action: "search", market: "us", limit: 50 };
      if (searchValues.cruiseLine && searchValues.cruiseLine !== "all") {
        params.operators = searchValues.cruiseLine;
      }
      const dest = searchValues.destination?.trim().toLowerCase();
      if (dest && dest !== "all" && AVAILABLE_DESTINATIONS.some((d) => d.value === dest)) {
        params.regions = dest;
      }
      if (searchValues.departurePort && searchValues.departurePort !== "all") {
        params.locations = searchValues.departurePort;
      }
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const { data, error } = await supabase.functions.invoke("widgety-cruise", { body: params });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      let results: WidgetySailing[] = data.holidays || [];

      // Optional ship narrowing (server-side via per-holiday call)
      if (searchValues.ship && searchValues.ship !== "all" && results.length) {
        const filtered = await Promise.all(
          results.map(async (h) => {
            try {
              const { data: detail } = await supabase.functions.invoke("widgety-cruise", {
                body: { action: "holiday", holiday_ref: h.holiday_ref, market: "us" },
              });
              const seasonDates = (detail?.operating_seasons || []).flatMap((s: any) => s.dates || []);
              const matches = seasonDates.some(
                (d: any) =>
                  typeof d.ship === "string" && d.ship.includes(`/ships/${searchValues.ship}.json`),
              );
              return matches ? h : null;
            } catch {
              return null;
            }
          }),
        );
        results = filtered.filter((h): h is WidgetySailing => h !== null);
      }

      setSailings(results);
      setTotalResults(
        searchValues.ship && searchValues.ship !== "all" ? results.length : data.total || results.length,
      );
      if (!results.length) toast.info("No cruises found. Try adjusting your search.");

      // Pricing
      if (results.length) {
        try {
          const refs = results.map((h) => h.holiday_ref).filter(Boolean);
          const { data: priceData } = await supabase.functions.invoke("widgety-price-sync", {
            body: { action: "get_prices", refs },
          });
          const cache: Record<string, number | null> = {};
          for (const p of priceData?.prices || []) {
            cache[p.holiday_ref] = p.price_from_double ? parseFloat(p.price_from_double) : null;
          }
          setPriceCache(cache);

          const missing = refs.filter((r) => !(r in cache));
          if (missing.length) {
            supabase.functions
              .invoke("widgety-price-sync", { body: { action: "sync_prices", refs: missing.slice(0, 20) } })
              .then(() =>
                supabase.functions.invoke("widgety-price-sync", {
                  body: { action: "get_prices", refs: missing.slice(0, 20) },
                }),
              )
              .then(({ data: r2 }) => {
                const next: Record<string, number | null> = {};
                for (const p of r2?.prices || []) {
                  next[p.holiday_ref] = p.price_from_double ? parseFloat(p.price_from_double) : null;
                }
                setPriceCache((prev) => ({ ...prev, ...next }));
              })
              .catch(() => {});
          }
        } catch {
          // pricing failures are non-fatal
        }
      }
    } catch (err) {
      console.error("Cruise search error:", err);
      toast.error("Search failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSearchValues(DEFAULT_SEARCH);
    setFilters(DEFAULT_FILTERS);
    setSailings([]);
    setHasSearched(false);
    setComparingRefs([]);
    setPriceCache({});
  };

  // Derive available filter options from current results
  const priceBounds = useMemo<[number, number]>(() => {
    const prices = Object.values(priceCache).filter((p): p is number => p != null && p > 0);
    if (!prices.length) return [0, 20000];
    const min = Math.floor(Math.min(...prices) / 100) * 100;
    const max = Math.ceil(Math.max(...prices) / 100) * 100;
    return [min, Math.max(max, min + 1000)];
  }, [priceCache]);

  // Initialize price slider when bounds change
  useEffect(() => {
    setFilters((f) => ({ ...f, priceRange: priceBounds }));
  }, [priceBounds]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const s of sailings) {
      const k = getMonthKey(s.date_from);
      if (k) months.add(k);
    }
    return Array.from(months).sort();
  }, [sailings]);

  // Apply client-side filters + sort
  const filteredSailings = useMemo(() => {
    let out = sailings.filter((s) => {
      const op = operatorSlugFromTitle(s.operator_title);
      // Cruise line
      if (filters.cruiseLines.length && !filters.cruiseLines.includes(op)) return false;
      // Type
      if (filters.cruiseType !== "all" && getCruiseType(op) !== filters.cruiseType) return false;
      // Audience
      if (filters.audience.length) {
        const tags = getAudienceTags(op);
        if (!filters.audience.some((a) => tags.includes(a))) return false;
      }
      // Months
      if (filters.months.length && !filters.months.includes(getMonthKey(s.date_from))) return false;
      // Duration
      const n = s.nights || 0;
      if (n > 0 && (n < filters.durationRange[0] || (n > filters.durationRange[1] && filters.durationRange[1] < 30))) {
        return false;
      }
      // Price
      const price = priceCache[s.holiday_ref];
      if (price != null && (price < filters.priceRange[0] || price > filters.priceRange[1])) {
        return false;
      }
      return true;
    });

    // Sort
    const arr = [...out];
    if (sort === "price_asc") {
      arr.sort((a, b) => {
        const pa = priceCache[a.holiday_ref] ?? Infinity;
        const pb = priceCache[b.holiday_ref] ?? Infinity;
        return pa - pb;
      });
    } else if (sort === "date_asc") {
      arr.sort((a, b) => (a.date_from || "").localeCompare(b.date_from || ""));
    } else if (sort === "duration_asc") {
      arr.sort((a, b) => (a.nights || 999) - (b.nights || 999));
    } else {
      // recommended: priced first, then earliest
      arr.sort((a, b) => {
        const ap = priceCache[a.holiday_ref] != null ? 0 : 1;
        const bp = priceCache[b.holiday_ref] != null ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return (a.date_from || "").localeCompare(b.date_from || "");
      });
    }
    return arr;
  }, [sailings, filters, priceCache, sort]);

  const toggleCompare = (ref: string) => {
    setComparingRefs((prev) => {
      if (prev.includes(ref)) return prev.filter((r) => r !== ref);
      if (prev.length >= 4) {
        toast.info("You can compare up to 4 cruises at once.");
        return prev;
      }
      return [...prev, ref];
    });
  };

  const comparingSailings = useMemo(
    () => sailings.filter((s) => comparingRefs.includes(s.holiday_ref)),
    [sailings, comparingRefs],
  );

  const sidebarFilters = (
    <FilterSidebar
      filters={filters}
      onChange={setFilters}
      availableMonths={availableMonths}
      availableShips={availableShips}
      priceBounds={priceBounds}
    />
  );

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-24">
        <CruiseSearchHeader />

        <SearchBar
          values={searchValues}
          onChange={setSearchValues}
          onSearch={handleSearch}
          onReset={handleReset}
          loading={loading}
          availableShips={availableShips}
          shipsLoading={shipsLoading}
        />

        {hasSearched ? (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
            {/* Desktop sidebar */}
            <div className="hidden lg:block lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)]">
              {sidebarFilters}
            </div>

            {/* Mobile filter trigger */}
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Filter className="h-4 w-4 mr-2" /> Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[320px] sm:w-[380px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">{sidebarFilters}</div>
                </SheetContent>
              </Sheet>
            </div>

            <CruiseResults
              sailings={filteredSailings}
              totalResults={loading ? 0 : filteredSailings.length}
              loading={loading}
              sort={sort}
              onSortChange={setSort}
              priceCache={priceCache}
              comparingRefs={comparingRefs}
              onToggleCompare={toggleCompare}
              onViewDetails={(s) => {
                setDetailsSailing(s);
                setDetailsOpen(true);
              }}
              onSelect={(s) => {
                setDetailsSailing(s);
                setDetailsOpen(true);
              }}
              onResetFilters={() => setFilters({ ...DEFAULT_FILTERS, priceRange: priceBounds })}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20 border rounded-lg bg-card">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Filter className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Search the world's cruises</h2>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              Pick a destination, cruise line, or sail date and we'll find the best options from
              20+ premium operators.
            </p>
            <Button onClick={handleSearch} className="mt-6">
              Browse all cruises
            </Button>
          </div>
        )}

        <CompareDrawer
          sailings={comparingSailings}
          priceCache={priceCache}
          onRemove={(ref) => setComparingRefs((p) => p.filter((r) => r !== ref))}
          onClear={() => setComparingRefs([])}
        />

        <CruiseDetailsModal
          sailing={detailsSailing}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          dateFrom={dateFrom}
          dateTo={dateTo}
          priceCache={priceCache}
          alternateSailings={
            detailsSailing
              ? filteredSailings.filter((s) => s.holiday_ref !== detailsSailing.holiday_ref)
              : []
          }
          onSelectAlternateSailing={(s) => setDetailsSailing(s)}
        />
      </div>
    </DashboardLayout>
  );
}
