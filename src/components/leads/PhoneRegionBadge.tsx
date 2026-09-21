import { Badge } from "@/components/ui/badge";
import { getAreaCodeRegion } from "@/lib/areaCodes";
import { cn } from "@/lib/utils";

interface PhoneRegionBadgeProps {
  phone?: string | null;
  className?: string;
}

/**
 * Small badge showing the likely city/region for a phone number's area code.
 * Renders nothing when the number is missing or the area code is unknown.
 */
export function PhoneRegionBadge({ phone, className }: PhoneRegionBadgeProps) {
  const match = getAreaCodeRegion(phone);
  if (!match) return null;

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-normal text-muted-foreground", className)}
      title={`Area code ${match.areaCode} — ${match.region}`}
    >
      {match.region}
    </Badge>
  );
}
