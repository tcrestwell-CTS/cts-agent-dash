import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Ship, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CabinOption {
  id: string;
  category_name: string;
  description: string | null;
  price_per_person: number;
  deposit_amount: number | null;
  capacity: number | null;
  image_url: string | null;
  sort_order: number;
}

interface BalconyCabinsSectionProps {
  tripId: string;
}

export function BalconyCabinsSection({ tripId }: BalconyCabinsSectionProps) {
  const [cabins, setCabins] = useState<CabinOption[]>([]);
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);

      // Fetch all cabin options for this trip that contain "balcony" (case-insensitive)
      const { data: allCabins } = await supabase
        .from("trip_cabin_options")
        .select("*")
        .eq("trip_id", tripId)
        .order("sort_order", { ascending: true });

      const balconyCabins = (allCabins || []).filter((c: any) =>
        c.category_name.toLowerCase().includes("balcony")
      ) as CabinOption[];

      setCabins(balconyCabins);

      if (balconyCabins.length > 0) {
        // Count sub-trips that selected each balcony cabin option
        const { data: subTrips } = await supabase
          .from("trips")
          .select("selected_cabin_option_id")
          .eq("parent_trip_id", tripId)
          .not("selected_cabin_option_id", "is", null);

        const counts: Record<string, number> = {};
        (subTrips || []).forEach((t: any) => {
          if (t.selected_cabin_option_id) {
            counts[t.selected_cabin_option_id] = (counts[t.selected_cabin_option_id] || 0) + 1;
          }
        });
        setBookingCounts(counts);
      }

      setLoading(false);
    }
    fetch();
  }, [tripId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (cabins.length === 0) return null;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Ship className="h-5 w-5" />
          Balcony Cabins
          <Badge variant="secondary" className="ml-auto text-xs">
            {cabins.length} {cabins.length === 1 ? "option" : "options"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cabins.map((cabin) => {
          const booked = bookingCounts[cabin.id] || 0;
          const cap = cabin.capacity;
          const remaining = cap != null ? Math.max(0, cap - booked) : null;
          const pct = cap != null && cap > 0 ? Math.min(100, (booked / cap) * 100) : 0;
          const soldOut = cap != null && remaining === 0;

          return (
            <div
              key={cabin.id}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                soldOut ? "bg-destructive/5 border-destructive/20" : "bg-card hover:bg-muted/30"
              }`}
            >
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
                    {formatCurrency(cabin.price_per_person)} / person
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

                {/* Availability bar */}
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
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
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
                    <Progress
                      value={pct}
                      className="h-2"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}