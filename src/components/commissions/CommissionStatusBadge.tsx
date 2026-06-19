import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO, isValid } from "date-fns";

export type CommissionComputedStatus = "received" | "overdue" | "upcoming" | "paid";

/**
 * Compute a Tern-style status from raw commission data.
 *
 * Rules:
 *   - status === "paid"  → "received"  (already paid out)
 *   - expectedDate in the past → "overdue"
 *   - expectedDate within 30 days → "upcoming"
 *   - otherwise → "upcoming" (far out)
 */
export function computeCommissionStatus(
  status: string,
  expectedDateStr: string | null | undefined
): CommissionComputedStatus {
  if (status === "paid") return "received";

  if (!expectedDateStr) return "upcoming";

  const expected = parseISO(expectedDateStr);
  if (!isValid(expected)) return "upcoming";

  const daysUntil = differenceInDays(expected, new Date());

  if (daysUntil < 0) return "overdue";
  return "upcoming";
}

const CONFIG: Record<
  CommissionComputedStatus,
  { label: string; className: string }
> = {
  received: {
    label: "Received",
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  overdue: {
    label: "Overdue",
    className:
      "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400",
  },
  upcoming: {
    label: "Upcoming",
    className:
      "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400",
  },
  paid: {
    label: "Received",
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
};

interface Props {
  status: string;
  expectedDate?: string | null;
  daysLabel?: boolean;
}

export function CommissionStatusBadge({ status, expectedDate, daysLabel }: Props) {
  const computed = computeCommissionStatus(status, expectedDate);
  const { label, className } = CONFIG[computed];

  const daysUntil =
    daysLabel && expectedDate && computed !== "received"
      ? differenceInDays(parseISO(expectedDate), new Date())
      : null;

  const suffix =
    daysUntil !== null
      ? daysUntil < 0
        ? ` (${Math.abs(daysUntil)}d late)`
        : daysUntil === 0
        ? " (today)"
        : ` (${daysUntil}d)`
      : "";

  return (
    <Badge variant="outline" className={`text-xs font-medium ${className}`}>
      {label}
      {suffix}
    </Badge>
  );
}
