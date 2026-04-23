import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RotateCcw, Loader2 } from "lucide-react";
import {
  AVAILABLE_DESTINATIONS,
  AVAILABLE_OPERATORS,
  DEPARTURE_PORTS,
} from "./types";

export interface SearchBarValues {
  destination: string;
  cruiseLine: string;
  ship: string;
  fromYear: string;
  fromMonth: string;
  toYear: string;
  toMonth: string;
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

const monthOptions = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

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
  const yearOptions = [currentYear, currentYear + 1, currentYear + 2];

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
        <div>
          <Label className="text-xs text-muted-foreground">From Year</Label>
          <Select value={values.fromYear} onValueChange={(v) => set("fromYear", v)}>
            <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">From Month</Label>
          <Select
            value={values.fromMonth}
            onValueChange={(v) => set("fromMonth", v)}
            disabled={!values.fromYear || values.fromYear === "all"}
          >
            <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To Year</Label>
          <Select value={values.toYear} onValueChange={(v) => set("toYear", v)}>
            <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To Month</Label>
          <Select
            value={values.toMonth}
            onValueChange={(v) => set("toMonth", v)}
            disabled={!values.toYear || values.toYear === "all"}
          >
            <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
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