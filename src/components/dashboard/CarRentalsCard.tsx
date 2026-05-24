import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Car, ArrowRight } from "lucide-react";
import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function CarRentalsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-car-rentals"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const in7 = format(addDays(new Date(), 7), "yyyy-MM-dd");

      const [{ count: needsAttention }, { count: upcoming }] = await Promise.all([
        supabase
          .from("car_rental_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "pending"]),
        supabase
          .from("car_rental_requests")
          .select("id", { count: "exact", head: true })
          .gte("pickup_date", today)
          .lte("pickup_date", in7),
      ]);

      return {
        needsAttention: needsAttention ?? 0,
        upcoming: upcoming ?? 0,
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Car className="h-4 w-4 text-primary" />
          Car Rentals
        </CardTitle>
        <Link
          to="/car-rentals"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <>
            <Link
              to="/car-rentals?status=needs_attention"
              className="flex items-center justify-between rounded-md border border-border/60 p-3 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="text-xs text-muted-foreground">Needs attention</p>
                <p className="text-xl font-semibold">{data?.needsAttention ?? 0}</p>
              </div>
              {(data?.needsAttention ?? 0) > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                  New / Pending
                </Badge>
              )}
            </Link>
            <Link
              to="/car-rentals"
              className="flex items-center justify-between rounded-md border border-border/60 p-3 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="text-xs text-muted-foreground">Upcoming pickups (7d)</p>
                <p className="text-xl font-semibold">{data?.upcoming ?? 0}</p>
              </div>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}