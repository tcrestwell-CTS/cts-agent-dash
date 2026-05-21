import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, Target } from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TripReadinessScoreProps {
  tripId: string;
  departDate: string | null;
  returnDate: string | null;
  hasSupplierBooking: boolean;
  totalCommissionRevenue: number;
  hasConfirmationNumber?: boolean;
  clientId?: string | null;
}

export function TripReadinessScore({
  tripId,
  departDate,
  returnDate,
  hasSupplierBooking,
  totalCommissionRevenue,
  hasConfirmationNumber = false,
  clientId,
}: TripReadinessScoreProps) {

  const { data: extra } = useQuery({
    queryKey: ["readiness-extra", tripId],
    queryFn: async () => {
      const [paymentsRes, travelersRes, portalRes] = await Promise.all([
        supabase.from("trip_payments").select("id").eq("trip_id", tripId).eq("status", "paid").limit(1),
        supabase.from("trip_travelers").select("id").eq("trip_id", tripId).limit(1),
        supabase.from("trips").select("id").eq("id", tripId).maybeSingle(),
      ]);
      return {
        hasPayment:        (paymentsRes.data?.length ?? 0) > 0,
        hasTravelers:      (travelersRes.data?.length ?? 0) > 0,
        portalShared:      false,
      };
    },
    enabled: !!tripId,
    staleTime: 1000 * 60 * 2,
  });

  const checks = [
    { label: "Dates confirmed",          checked: !!(departDate && returnDate),  detail: "Set departure and return dates" },
    { label: "Supplier booked",          checked: hasSupplierBooking,            detail: "Add at least one supplier booking" },
    { label: "Confirmation # entered",   checked: hasConfirmationNumber,         detail: "Enter supplier confirmation number on a booking" },
    { label: "Payment received",         checked: extra?.hasPayment ?? false,    detail: "At least one payment marked paid" },
    { label: "Client portal shared",     checked: extra?.portalShared ?? false,  detail: "Publish and share the client portal link" },
    { label: "Travelers added",          checked: extra?.hasTravelers ?? false,  detail: "Add travelers to the trip" },
  ];

  const completedCount = checks.filter(c => c.checked).length;
  const total = checks.length;
  const isReady = completedCount === total;
  const pct = Math.round((completedCount / total) * 100);

  // Color by completion
  const ringColor = isReady
    ? "text-green-500"
    : completedCount >= 4
      ? "text-amber-500"
      : "text-muted-foreground";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-default transition-colors",
            isReady ? "border-green-200 bg-green-50/60" : "border-border bg-card"
          )}>
            {/* Circular progress */}
            <div className="relative h-9 w-9 shrink-0">
              <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor"
                  className="text-muted/30" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor"
                  className={ringColor}
                  strokeWidth="3"
                  strokeDasharray={`${pct * 0.942} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
              <span className={cn("absolute inset-0 flex items-center justify-center text-xs font-bold", ringColor)}>
                {completedCount}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-semibold leading-none", isReady ? "text-green-700" : "text-foreground")}>
                {isReady ? "Trip Ready" : `${completedCount} of ${total} complete`}
              </p>
              {!isReady && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {checks.find(c => !c.checked)?.label}
                </p>
              )}
            </div>

            {/* Dot indicators */}
            <div className="flex gap-1">
              {checks.map((check, i) => (
                <div key={i} className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  check.checked ? "bg-green-500" : "bg-muted-foreground/25"
                )} />
              ))}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-3 space-y-1.5 w-56">
          <p className="text-xs font-semibold text-foreground mb-2">Trip Readiness Checklist</p>
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-2">
              {check.checked
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              }
              <span className={cn("text-xs", check.checked ? "text-foreground" : "text-muted-foreground")}>
                {check.checked ? check.label : check.detail}
              </span>
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
