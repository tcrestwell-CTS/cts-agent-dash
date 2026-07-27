import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Ship, Users, CheckCircle2, AlertTriangle, BedDouble, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SubTripInfo {
  id: string;
  trip_name: string;
  status: string;
  client_id: string | null;
  client_name?: string;
}

interface CabinOption {
  id: string;
  category_name: string;
  description: string | null;
  price_per_person: number;
  deposit_amount: number | null;
  capacity: number | null;
  image_url: string | null;
  sort_order: number;
  price_period?: 'trip' | 'night';
}

interface CabinAvailabilitySectionProps {
  tripId: string;
}

export function BalconyCabinsSection({ tripId }: CabinAvailabilitySectionProps) {
  const [allCabins, setAllCabins] = useState<CabinOption[]>([]);
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({});
  const [subTripsByOption, setSubTripsByOption] = useState<Record<string, SubTripInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "balcony">("all");
  const [expandedCabin, setExpandedCabin] = useState<string | null>(null);
  const [drillLoading, setDrillLoading] = useState<string | null>(null);
  const [defaultNights, setDefaultNights] = useState<number>(1);
  const [estimators, setEstimators] = useState<Record<string, { enabled: boolean; persons: number; nights: number }>>({});

  useEffect(() => {
    async function fetch() {
      setLoading(true);

      const { data: tripRow } = await supabase
        .from("trips")
        .select("departure_date, return_date")
        .eq("id", tripId)
        .maybeSingle();
      let nights = 1;
      if (tripRow?.departure_date && tripRow?.return_date) {
        const dep = new Date(`${tripRow.departure_date}T00:00:00`);
        const ret = new Date(`${tripRow.return_date}T00:00:00`);
        const diff = Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 0) nights = diff;
      }
      setDefaultNights(nights);

      const { data: cabinData } = await supabase
        .from("trip_cabin_options")
        .select("*")
        .eq("trip_id", tripId)
        .order("sort_order", { ascending: true });

      const fetched = (cabinData || []) as CabinOption[];
      setAllCabins(fetched);

      // initialize estimator defaults for per-night cabins
      const init: Record<string, { enabled: boolean; persons: number; nights: number }> = {};
      fetched.forEach((c) => {
        if (c.price_period === 'night') {
          init[c.id] = { enabled: false, persons: 2, nights };
        }
      });
      setEstimators(init);

      if (fetched.length > 0) {
        const { data: subTrips } = await supabase
          .from("trips")
          .select("id, trip_name, status, client_id, selected_cabin_option_id")
          .eq("parent_trip_id", tripId)
          .not("selected_cabin_option_id", "is", null);

        const counts: Record<string, number> = {};
        const grouped: Record<string, SubTripInfo[]> = {};
        (subTrips || []).forEach((t: any) => {
          if (t.selected_cabin_option_id) {
            counts[t.selected_cabin_option_id] = (counts[t.selected_cabin_option_id] || 0) + 1;
            if (!grouped[t.selected_cabin_option_id]) grouped[t.selected_cabin_option_id] = [];
            grouped[t.selected_cabin_option_id].push(t);
          }
        });
        setBookingCounts(counts);

        // Fetch client names for all sub-trips
        const clientIds = [...new Set((subTrips || []).map((t: any) => t.client_id).filter(Boolean))];
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, name")
            .in("id", clientIds);
          const clientMap: Record<string, string> = {};
          (clients || []).forEach((c: any) => { clientMap[c.id] = c.name; });
          for (const key of Object.keys(grouped)) {
            grouped[key] = grouped[key].map((st) => ({
              ...st,
              client_name: st.client_id ? clientMap[st.client_id] || "Unknown" : "No client",
            }));
          }
        }
        setSubTripsByOption(grouped);
      }

      setLoading(false);
    }
    fetch();
  }, [tripId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (allCabins.length === 0) return null;

  const hasBalcony = allCabins.some((c) =>
    c.category_name.toLowerCase().includes("balcony")
  );

  const displayedCabins =
    filter === "balcony"
      ? allCabins.filter((c) => c.category_name.toLowerCase().includes("balcony"))
      : allCabins;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BedDouble className="h-5 w-5" />
            Cabin Availability
            <Badge variant="secondary" className="text-xs">
              {displayedCabins.length} {displayedCabins.length === 1 ? "option" : "options"}
            </Badge>
          </CardTitle>
          {hasBalcony && (
            <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "balcony")}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3 h-7">All Cabins</TabsTrigger>
                <TabsTrigger value="balcony" className="text-xs px-3 h-7">
                  <Ship className="h-3 w-3 mr-1" />
                  Balcony
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayedCabins.map((cabin) => {
          const booked = bookingCounts[cabin.id] || 0;
          const cap = cabin.capacity;
          const remaining = cap != null ? Math.max(0, cap - booked) : null;
          const pct = cap != null && cap > 0 ? Math.min(100, (booked / cap) * 100) : 0;
          const soldOut = cap != null && remaining === 0;

          const isExpanded = expandedCabin === cabin.id;
          const subTrips = subTripsByOption[cabin.id] || [];

          return (
            <Collapsible
              key={cabin.id}
              open={isExpanded}
              onOpenChange={(open) => setExpandedCabin(open ? cabin.id : null)}
            >
            <div
              className={`rounded-lg border transition-colors ${
                soldOut ? "bg-destructive/5 border-destructive/20" : "bg-card"
              }`}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full text-left flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors rounded-lg">
                  {cabin.image_url && (
                    <img
                      src={cabin.image_url}
                      alt={cabin.category_name}
                      className="w-24 h-16 rounded-md object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{cabin.category_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {formatCurrency(cabin.price_per_person)} / person{cabin.price_period === 'night' ? ' / night' : ''}
                      </Badge>
                      {cabin.deposit_amount != null && cabin.deposit_amount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {formatCurrency(cabin.deposit_amount)} deposit
                        </Badge>
                      )}
                      {soldOut && (
                        <Badge variant="destructive" className="text-xs">Sold Out</Badge>
                      )}
                    </div>

                    {cabin.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{cabin.description}</p>
                    )}

                    {cabin.price_period === 'night' && (
                      <div
                        className="mt-2 rounded-md border bg-muted/20 p-2 space-y-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={estimators[cabin.id]?.enabled || false}
                            onChange={(e) =>
                              setEstimators((prev) => ({
                                ...prev,
                                [cabin.id]: {
                                  persons: prev[cabin.id]?.persons ?? 2,
                                  nights: prev[cabin.id]?.nights ?? defaultNights,
                                  enabled: e.target.checked,
                                },
                              }))
                            }
                          />
                          Calculate total (per person × per night)
                        </label>
                        {estimators[cabin.id]?.enabled && (
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Persons</Label>
                              <Input
                                type="number"
                                min={1}
                                className="h-8 w-20 text-sm"
                                value={estimators[cabin.id]?.persons ?? 2}
                                onChange={(e) =>
                                  setEstimators((prev) => ({
                                    ...prev,
                                    [cabin.id]: {
                                      ...(prev[cabin.id] || { enabled: true, nights: defaultNights }),
                                      persons: Math.max(1, parseInt(e.target.value) || 1),
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nights</Label>
                              <Input
                                type="number"
                                min={1}
                                className="h-8 w-20 text-sm"
                                value={estimators[cabin.id]?.nights ?? defaultNights}
                                onChange={(e) =>
                                  setEstimators((prev) => ({
                                    ...prev,
                                    [cabin.id]: {
                                      ...(prev[cabin.id] || { enabled: true, persons: 2 }),
                                      nights: Math.max(1, parseInt(e.target.value) || 1),
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="ml-auto text-right">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Estimated Total</p>
                              <p className="text-base font-bold">
                                {formatCurrency(
                                  (cabin.price_per_person || 0) *
                                    (estimators[cabin.id]?.persons || 1) *
                                    (estimators[cabin.id]?.nights || 1)
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {booked} booked
                          {cap != null && <span>of {cap}</span>}
                        </span>
                        {remaining != null ? (
                          <span className="flex items-center gap-1">
                            {remaining > 0 ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-success" />
                                {remaining} remaining
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-3 w-3 text-destructive" />
                                No availability
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="italic">Unlimited</span>
                        )}
                      </div>
                      {cap != null && cap > 0 && (
                        <Progress value={pct} className="h-2" />
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 mt-1 text-muted-foreground">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t px-4 py-3 space-y-2">
                  {subTrips.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-2">No sub-trips booked for this cabin yet.</p>
                  ) : (
                    subTrips.map((st) => (
                      <Link
                        key={st.id}
                        to={`/trips/${st.id}`}
                        className="flex items-center justify-between p-2.5 rounded-md border bg-muted/20 hover:bg-muted/40 transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{st.trip_name}</p>
                          <p className="text-xs text-muted-foreground">{st.client_name || "No client"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs capitalize">{st.status}</Badge>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}