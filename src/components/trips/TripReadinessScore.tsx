import { CheckCircle2, Circle, Target } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TripReadinessScoreProps {
  departDate: string | null;
  returnDate: string | null;
  hasSupplierBooking: boolean;
  totalCommissionRevenue: number;
}

export function TripReadinessScore({
  departDate,
  returnDate,
  hasSupplierBooking,
  totalCommissionRevenue,
}: TripReadinessScoreProps) {
  const items = [
    { label: "Dates confirmed", checked: !!departDate && !!returnDate },
    { label: "Supplier checked", checked: hasSupplierBooking },
    { label: "Margin confirmed", checked: totalCommissionRevenue > 0 },
  ];

  const completedCount = items.filter((i) => i.checked).length;
  const isReady = completedCount === items.length;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
            {isReady ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : (
              <Target className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <span className={cn("text-sm font-medium", isReady ? "text-success" : "text-muted-foreground")}>
              {isReady ? "Trip Ready" : `${completedCount}/${items.length} Ready`}
            </span>
            {!isReady && (
              <div className="flex gap-1 ml-auto">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-2 w-2 rounded-full",
                      item.checked ? "bg-success" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="space-y-1">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs">
              {item.checked ? (
                <CheckCircle2 className="h-3 w-3 text-success" />
              ) : (
                <Circle className="h-3 w-3 text-muted-foreground" />
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
