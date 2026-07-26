import { differenceInDays, parseISO, format } from "date-fns";
import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import { SemanticStatusPill, type SemanticStatus } from "@/components/patterns/StatusPill";

interface DepartureUrgencyBadgeProps {
  departDate: string | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export function DepartureUrgencyBadge({
  departDate,
  className,
  showIcon = true,
}: DepartureUrgencyBadgeProps) {
  if (!departDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dep = parseISO(departDate);
  const days = differenceInDays(dep, today);

  if (days < 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-[11.5px] text-muted-foreground/60", className)}>
        {showIcon && <Plane className="h-3 w-3" />}
        Departed {format(dep, "MMM d")}
      </span>
    );
  }

  const label =
    days === 0 ? "Departs today" :
    days === 1 ? "Departs tomorrow" :
    days <= 7  ? `${days}d to departure` :
    days <= 30 ? `${days}d to departure` :
    format(dep, "MMM d, yyyy");

  const status: SemanticStatus =
    days <= 3  ? "destructive" :
    days <= 30 ? "warning" :
    "muted";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {showIcon && <Plane className="h-3 w-3 text-muted-foreground" />}
      <SemanticStatusPill status={status} label={label} />
    </span>
  );
}
