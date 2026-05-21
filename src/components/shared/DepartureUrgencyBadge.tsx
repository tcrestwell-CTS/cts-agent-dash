import { differenceInDays, parseISO, format } from "date-fns";
import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground/60", className)}>
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

  const colorClass =
    days === 0 ? "text-red-600 font-semibold" :
    days <= 3  ? "text-red-500 font-semibold" :
    days <= 7  ? "text-amber-600 font-medium" :
    days <= 30 ? "text-amber-500" :
    "text-muted-foreground";

  const bgClass =
    days <= 3  ? "bg-red-50 border-red-200" :
    days <= 7  ? "bg-amber-50 border-amber-200" :
    days <= 30 ? "bg-amber-50/50 border-amber-100" :
    "bg-transparent border-transparent";

  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border",
      colorClass, bgClass, className
    )}>
      {showIcon && <Plane className="h-3 w-3" />}
      {label}
    </span>
  );
}
