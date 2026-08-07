import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MscCruiseRow } from "./MscCruiseSearch";

type Fare = {
  fare_code: string;
  fare_description: string | null;
  category_code: string | null;
  occupancy_key: string;
  cabin_price: number | null;
  gft_adult: number | null;
  service_charge_adult_standard: number | null;
  currency_code: string;
  cruise_only: boolean;
  now_available: boolean;
};

const money = (n: number | null | undefined, cur = "USD") =>
  n == null ? "—" : new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n);

export function MscFareDrawer({
  cruise,
  onClose,
}: {
  cruise: MscCruiseRow | null;
  onClose: () => void;
}) {
  const [fares, setFares] = useState<Fare[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cruise) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("msc_fares")
      .select(
        "fare_code, fare_description, category_code, occupancy_key, cabin_price, gft_adult, service_charge_adult_standard, currency_code, cruise_only, now_available",
      )
      .eq("cruise_id", cruise.cruise_id)
      .eq("is_closed", false)
      .order("cabin_price", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (!cancelled) setFares((data ?? []) as Fare[]);
      })
      .then(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [cruise]);

  return (
    <Sheet open={!!cruise} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{cruise?.itinerary_name || "MSC sailing"}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{cruise?.cruise_id}</SheetDescription>
        </SheetHeader>

        <div className="mt-5">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : !fares.length ? (
            <p className="text-sm text-muted-foreground">
              No cached fares for this sailing yet. Fares populate from the MSC cache sync.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fare</TableHead>
                  <TableHead>Cat.</TableHead>
                  <TableHead>Occ.</TableHead>
                  <TableHead className="text-right">Cabin</TableHead>
                  <TableHead className="text-right">GFT</TableHead>
                  <TableHead className="text-right">Svc / adult</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fares.map((f, i) => (
                  <TableRow key={`${f.fare_code}-${f.category_code}-${f.occupancy_key}-${i}`}>
                    <TableCell className="text-xs">
                      <div className="font-medium">{f.fare_code}</div>
                      {f.fare_description && (
                        <div className="text-muted-foreground">{f.fare_description}</div>
                      )}
                      <div className="mt-1 flex gap-1">
                        {f.cruise_only && (
                          <Badge variant="outline" className="text-[10px]">
                            Cruise only
                          </Badge>
                        )}
                        {!f.now_available && (
                          <Badge variant="outline" className="text-[10px]">
                            Not now-available
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{f.category_code || "—"}</TableCell>
                    <TableCell className="text-xs">{f.occupancy_key}</TableCell>
                    <TableCell className="text-right text-xs">
                      {money(f.cabin_price, f.currency_code)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {money(f.gft_adult, f.currency_code)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {money(f.service_charge_adult_standard, f.currency_code)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
