import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AVAILABLE_DESTINATIONS,
  AVAILABLE_OPERATORS,
  DEPARTURE_PORTS,
  type CruiseFilterState,
  DEFAULT_FILTERS,
} from "./types";
import { promotionLabel, formatPrice } from "./utils";
import { RotateCcw } from "lucide-react";

interface FilterSidebarProps {
  filters: CruiseFilterState;
  onChange: (filters: CruiseFilterState) => void;
  availableMonths?: string[];
  availableShips?: { title: string; slug: string }[];
  availablePromotions?: string[];
  priceBounds?: [number, number];
}

export function FilterSidebar({
  filters,
  onChange,
  availableMonths = [],
  availableShips = [],
  availablePromotions = [],
  priceBounds = [0, 20000],
}: FilterSidebarProps) {
  const toggle = <K extends keyof CruiseFilterState>(
    key: K,
    value: string,
  ) => {
    const arr = filters[key] as unknown as string[];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    onChange({ ...filters, [key]: next as CruiseFilterState[K] });
  };

  const reset = () => onChange({ ...DEFAULT_FILTERS, priceRange: priceBounds });

  const activeCount =
    filters.destinations.length +
    filters.ports.length +
    filters.cruiseLines.length +
    filters.ships.length +
    filters.months.length +
    filters.promotions.length +
    filters.audience.length +
    (filters.cruiseType !== "all" ? 1 : 0);

  return (
    <aside className="bg-muted/30 border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">
          Filters {activeCount > 0 && <span className="text-muted-foreground">({activeCount})</span>}
        </h3>
        <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs">
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
      </div>
      <Separator className="mb-2" />
      <ScrollArea className="h-[calc(100vh-280px)] pr-3">
        <Accordion
          type="multiple"
          defaultValue={["destination", "line", "duration", "price"]}
          className="w-full"
        >
          <AccordionItem value="destination">
            <AccordionTrigger className="text-sm py-2">Destination</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {AVAILABLE_DESTINATIONS.map((d) => (
                  <label key={d.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={filters.destinations.includes(d.value)}
                      onCheckedChange={() => toggle("destinations", d.value)}
                    />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="port">
            <AccordionTrigger className="text-sm py-2">Departure Port</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {DEPARTURE_PORTS.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={filters.ports.includes(p.value)}
                      onCheckedChange={() => toggle("ports", p.value)}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="line">
            <AccordionTrigger className="text-sm py-2">Cruise Line</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {AVAILABLE_OPERATORS.map((op) => (
                  <label key={op.slug} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={filters.cruiseLines.includes(op.slug)}
                      onCheckedChange={() => toggle("cruiseLines", op.slug)}
                    />
                    <span>{op.label}</span>
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {availableShips.length > 0 && (
            <AccordionItem value="ship">
              <AccordionTrigger className="text-sm py-2">Ship</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {availableShips.map((s) => (
                    <label key={s.slug} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filters.ships.includes(s.slug)}
                        onCheckedChange={() => toggle("ships", s.slug)}
                      />
                      <span>{s.title}</span>
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {availableMonths.length > 0 && (
            <AccordionItem value="month">
              <AccordionTrigger className="text-sm py-2">Departure Month</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {availableMonths.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filters.months.includes(m)}
                        onCheckedChange={() => toggle("months", m)}
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="duration">
            <AccordionTrigger className="text-sm py-2">Duration (nights)</AccordionTrigger>
            <AccordionContent>
              <div className="px-1 pt-2">
                <Slider
                  value={filters.durationRange}
                  min={1}
                  max={30}
                  step={1}
                  onValueChange={(v) => onChange({ ...filters, durationRange: [v[0], v[1]] as [number, number] })}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{filters.durationRange[0]} nights</span>
                  <span>{filters.durationRange[1]}+ nights</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="price">
            <AccordionTrigger className="text-sm py-2">Price Range (pp)</AccordionTrigger>
            <AccordionContent>
              <div className="px-1 pt-2">
                <Slider
                  value={filters.priceRange}
                  min={priceBounds[0]}
                  max={priceBounds[1]}
                  step={100}
                  onValueChange={(v) => onChange({ ...filters, priceRange: [v[0], v[1]] as [number, number] })}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{formatPrice(filters.priceRange[0])}</span>
                  <span>{formatPrice(filters.priceRange[1])}+</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {availablePromotions.length > 0 && (
            <AccordionItem value="promotions">
              <AccordionTrigger className="text-sm py-2">Promotions</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {availablePromotions.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filters.promotions.includes(p)}
                        onCheckedChange={() => toggle("promotions", p)}
                      />
                      <span>{promotionLabel(p)}</span>
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="type">
            <AccordionTrigger className="text-sm py-2">Cruise Type</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {(["all", "ocean", "river"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="cruiseType"
                      checked={filters.cruiseType === t}
                      onChange={() => onChange({ ...filters, cruiseType: t })}
                      className="h-3.5 w-3.5"
                    />
                    <span className="capitalize">{t === "all" ? "All Types" : `${t} Cruise`}</span>
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="audience">
            <AccordionTrigger className="text-sm py-2">Travel Style</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {([
                  { value: "family", label: "Family Friendly" },
                  { value: "luxury", label: "Luxury" },
                  { value: "adults", label: "Adults Only" },
                ] as const).map((a) => (
                  <label key={a.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={filters.audience.includes(a.value)}
                      onCheckedChange={() => toggle("audience", a.value)}
                    />
                    <span>{a.label}</span>
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>
    </aside>
  );
}