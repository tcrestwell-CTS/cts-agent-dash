import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Anchor, CalendarDays, Loader2, MapPin, Search, Ship } from "lucide-react";
import { MscFareDrawer } from "./MscFareDrawer";

export type MscCruiseRow = {
  cruise_id: string;
  itinerary_name: string | null;
  sail_date: string | null;
  return_date: string | null;
  nights: number | null;
  ship_code: string | null;
  embark_port_code: string | null;
  disembark_port_code: string | null;
  area_code: string | null;
  region_code: string | null;
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export function MscCruiseSearch() {
  const [ships, setShips] = useState<{ ship_code: string; ship_name: string | null }[]>([]);
  const [ports, setPorts] = useState<{ port_code: string; port_name: string | null }[]>([]);
  const [itineraries, setItineraries] = useState<string[]>([]);
  const [shipCode, setShipCode] = useState("all");
  const [portCode, setPortCode] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [nights, setNights] = useState("any");
  const [keyword, setKeyword] = useState("all");

  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [rows, setRows] = useState<MscCruiseRow[]>([]);
  const [cacheCount, setCacheCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<MscCruiseRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: s }, { data: p }, { count }, { data: it }] = await Promise.all([
        supabase.from("msc_ships").select("ship_code, ship_name").order("ship_name"),
        supabase.from("msc_ports").select("port_code, port_name").order("port_name").limit(500),
        supabase.from("msc_cruises").select("cruise_id", { count: "exact", head: true }),
        supabase.from("msc_cruises").select("itinerary_name").eq("is_closed", false).limit(2000),
      ]);
      if (cancelled) return;
      setShips(s ?? []);
      setPorts(p ?? []);
      setCacheCount(count ?? 0);
      const names = Array.from(
        new Set(
          (it ?? [])
            .map((r) => (r.itinerary_name || "").trim())
            .filter((n) => n.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b));
      setItineraries(names);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const portName = useMemo(
    () => new Map(ports.map((p) => [p.port_code, p.port_name || p.port_code])),
    [ports],
  );
  const shipName = useMemo(
    () => new Map(ships.map((s) => [s.ship_code, s.ship_name || s.ship_code])),
    [ships],
  );

  const runSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      let q = supabase
        .from("msc_cruises")
        .select(
          "cruise_id, itinerary_name, sail_date, return_date, nights, ship_code, embark_port_code, disembark_port_code, area_code, region_code",
        )
        .eq("is_closed", false)
        .order("sail_date", { ascending: true })
        .limit(200);

      if (shipCode !== "all") q = q.eq("ship_code", shipCode);
      if (portCode !== "all") q = q.eq("embark_port_code", portCode);
      if (dateFrom) q = q.gte("sail_date", dateFrom);
      if (dateTo) q = q.lte("sail_date", dateTo);
      if (keyword !== "all") q = q.eq("itinerary_name", keyword);
      if (nights !== "any") {
        const [min, max] = nights.split("-").map(Number);
        q = q.gte("nights", min).lte("nights", max || 99);
      }

      const { data, error } = await q;
      if (error) throw error;
      const results = (data ?? []) as MscCruiseRow[];
      setRows(results);
      if (!results.length) toast.info("No MSC sailings matched. Try widening your filters.");
    } catch (err) {
      console.error("MSC search error:", err);
      toast.error("MSC search failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setShipCode("all");
    setPortCode("all");
    setDateFrom("");
    setDateTo("");
    setNights("any");
    setKeyword("all");
    setRows([]);
    setHasSearched(false);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Ship className="h-4 w-4 text-primary" />
            MSC Cruises — direct inventory
            {cacheCount !== null && (
              <Badge variant={cacheCount > 0 ? "secondary" : "outline"} className="ml-1">
                {cacheCount.toLocaleString()} cached sailings
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="space-y-1.5 xl:col-span-2">
              <Label className="text-xs">Itinerary</Label>
              <Select value={keyword} onValueChange={setKeyword}>
                <SelectTrigger>
                  <SelectValue placeholder="Any itinerary" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any itinerary</SelectItem>
                  {itineraries.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ship</Label>
              <Select value={shipCode} onValueChange={setShipCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Any ship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any ship</SelectItem>
                  {ships.map((s) => (
                    <SelectItem key={s.ship_code} value={s.ship_code}>
                      {s.ship_name || s.ship_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Embark port</Label>
              <Select value={portCode} onValueChange={setPortCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Any port" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any port</SelectItem>
                  {ports.map((p) => (
                    <SelectItem key={p.port_code} value={p.port_code}>
                      {p.port_name || p.port_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sail from</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sail to</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 w-[160px]">
              <Label className="text-xs">Nights</Label>
              <Select value={nights} onValueChange={setNights}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any length</SelectItem>
                  <SelectItem value="1-3">1–3 nights</SelectItem>
                  <SelectItem value="4-6">4–6 nights</SelectItem>
                  <SelectItem value="7-9">7–9 nights</SelectItem>
                  <SelectItem value="10-14">10–14 nights</SelectItem>
                  <SelectItem value="15-99">15+ nights</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Search MSC
            </Button>
            <Button variant="ghost" onClick={reset} disabled={loading}>
              Reset
            </Button>
          </div>

          {cacheCount === 0 && (
            <p className="text-xs text-muted-foreground">
              The MSC sailing cache is empty. Once the Cache REST ingest runs, sailings and fares
              appear here automatically.
            </p>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : hasSearched && !rows.length ? (
        <div className="border rounded-lg bg-card py-16 text-center">
          <Anchor className="h-7 w-7 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No MSC sailings found for these filters.</p>
        </div>
      ) : rows.length ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{rows.length} sailings</p>
          {rows.map((r) => (
            <Card key={r.cruise_id} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">
                      {r.itinerary_name || `MSC sailing ${r.cruise_id}`}
                    </h3>
                    {r.nights ? <Badge variant="secondary">{r.nights} nights</Badge> : null}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Ship className="h-3.5 w-3.5" />
                      {shipName.get(r.ship_code || "") || r.ship_code || "TBA"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmtDate(r.sail_date)} → {fmtDate(r.return_date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {portName.get(r.embark_port_code || "") || r.embark_port_code || "—"}
                    </span>
                    <span className="font-mono">{r.cruise_id}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelected(r)}>
                  View fares
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg bg-card py-16 text-center">
          <Ship className="h-7 w-7 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Search MSC inventory</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            Filter MSC sailings by ship, embark port, dates or itinerary, then open a sailing to see
            cabin categories and fare pricing.
          </p>
        </div>
      )}

      <MscFareDrawer cruise={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
