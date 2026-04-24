import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, RotateCcw, Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  AVAILABLE_DESTINATIONS,
  AVAILABLE_OPERATORS,
  DEPARTURE_PORTS,
} from "./types";

export interface SearchBarValues {
  destination: string;
  cruiseLine: string;
  ship: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  lengthPreset: string; // "any" | "1-3" | "4-6" | "7-9" | "10-14" | "15+"
  departurePort: string;
  travelers: string;
}

interface SearchBarProps {
  values: SearchBarValues;
  onChange: (values: SearchBarValues) => void;
  onSearch: () => void;
  onReset: () => void;
  loading?: boolean;
  availableShips?: { title: string; slug: string }[];
  shipsLoading?: boolean;
}

const lengthOptions = [
  { value: "any", label: "Any length" },
  { value: "1-3", label: "1–3 nights" },
  { value: "4-6", label: "4–6 nights" },
  { value: "7-9", label: "7–9 nights" },
  { value: "10-14", label: "10–14 nights" },
  { value: "15+", label: "15+ nights" },
];

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromIsoDate(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function SearchBar({
  values,
  onChange,
  onSearch,
  onReset,
  loading,
  availableShips = [],
  shipsLoading,
}: SearchBarProps) {
  const currentYear = new Date().getFullYear();

  const set = <K extends keyof SearchBarValues>(key: K, val: SearchBarValues[K]) =>
    onChange({ ...values, [key]: val });

  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
        <div className="col-span-2 md:col-span-2">
          <Label className="text-xs text-muted-foreground">Destination</Label>
          <Select value={values.destination} onValueChange={(v) => set("destination", v)}>
            <SelectTrigger><SelectValue placeholder="All destinations" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All Destinations</SelectItem>
              {AVAILABLE_DESTINATIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 md:col-span-2">
          <Label className="text-xs text-muted-foreground">Cruise Line</Label>
          <Select value={values.cruiseLine} onValueChange={(v) => set("cruiseLine", v)}>
            <SelectTrigger><SelectValue placeholder="All lines" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All Cruise Lines</SelectItem>
              {AVAILABLE_OPERATORS.map((op) => (
                <SelectItem key={op.slug} value={op.slug}>{op.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 md:col-span-2">
          <Label className="text-xs text-muted-foreground">Ship</Label>
          <Select
            value={values.ship}
            onValueChange={(v) => set("ship", v)}
            disabled={shipsLoading || !values.cruiseLine || values.cruiseLine === "all"}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !values.cruiseLine || values.cruiseLine === "all"
                  ? "Pick a line first"
                  : shipsLoading ? "Loading ships…" : "All ships"
              } />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All Ships</SelectItem>
              {availableShips.map((s) => (
                <SelectItem key={s.slug} value={s.slug}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 md:col-span-2">
          <Label className="text-xs text-muted-foreground">Departure Port</Label>
          <Select value={values.departurePort} onValueChange={(v) => set("departurePort", v)}>
            <SelectTrigger><SelectValue placeholder="All ports" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All Ports</SelectItem>
              {DEPARTURE_PORTS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 md:col-span-3">
          <Label className="text-xs text-muted-foreground">Departure Window</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !values.dateFrom && !values.dateTo && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                {values.dateFrom ? (
                  values.dateTo ? (
                    <span className="truncate">
                      {format(fromIsoDate(values.dateFrom)!, "MMM d, yyyy")} – {format(fromIsoDate(values.dateTo)!, "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span className="truncate">{format(fromIsoDate(values.dateFrom)!, "MMM d, yyyy")} – pick end</span>
                  )
                ) : (
                  <span>Any dates</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                numberOfMonths={2}
                defaultMonth={fromIsoDate(values.dateFrom) ?? new Date()}
                selected={{
                  from: fromIsoDate(values.dateFrom),
                  to: fromIsoDate(values.dateTo),
                } as DateRange}
                onSelect={(range) => {
                  onChange({
                    ...values,
                    dateFrom: range?.from ? toIsoDate(range.from) : "",
                    dateTo: range?.to ? toIsoDate(range.to) : "",
                  });
                }}
                disabled={(d) => d < new Date(currentYear, 0, 1) || d > new Date(currentYear + 2, 11, 31)}
                className={cn("p-3 pointer-events-auto")}
              />
              <div className="flex justify-end gap-2 p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ ...values, dateFrom: "", dateTo: "" })}
                >
                  Clear
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Length</Label>
          <Select value={values.lengthPreset || "any"} onValueChange={(v) => set("lengthPreset", v)}>
            <SelectTrigger><SelectValue placeholder="Any length" /></SelectTrigger>
            <SelectContent>
              {lengthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Button onClick={onSearch} disabled={loading} className="min-w-32">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          Search Cruises
        </Button>
        <Button variant="outline" onClick={onReset} disabled={loading}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  );
}