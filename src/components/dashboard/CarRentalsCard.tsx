import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Car, ArrowRight } from "lucide-react";
import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";

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
    <Panel>
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Car className="h-4 w-4 text-accent" />
            Car Rentals
          </span>
        }
        actions={
          <Link
            to="/car-rentals"
            className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />
      <PanelBody className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <>
            <Link
              to="/car-rentals?status=needs_attention"
              className="flex items-center justify-between rounded-[9px] border border-border p-3 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="text-[12.5px] text-muted-foreground">Needs attention</p>
                <p className="text-[20px] font-semibold tabular-nums text-foreground">{data?.needsAttention ?? 0}</p>
              </div>
              {(data?.needsAttention ?? 0) > 0 && (
                <span className="rounded-full bg-warning/15 px-[9px] py-[2px] text-[11.5px] font-semibold text-warning">
                  New / Pending
                </span>
              )}
            </Link>
            <Link
              to="/car-rentals"
              className="flex items-center justify-between rounded-[9px] border border-border p-3 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="text-[12.5px] text-muted-foreground">Upcoming pickups (7d)</p>
                <p className="text-[20px] font-semibold tabular-nums text-foreground">{data?.upcoming ?? 0}</p>
              </div>
            </Link>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
