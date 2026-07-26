import { cn } from "@/lib/utils";

interface StatusPillProps {
  /** Any CSS color: a hex value (from a dynamic per-user status), or an hsl()/token reference. */
  color: string;
  label: string;
  className?: string;
}

/**
 * Generic status pill — this app's trip/booking statuses are dynamic and
 * per-user (see useTripStatuses), not a fixed enum, so this takes a color
 * directly rather than assuming a fixed status vocabulary.
 */
export function StatusPill({ color, label, className }: StatusPillProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-[9px] py-[2px] text-[11.5px] font-semibold", className)}
      style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      {label}
    </span>
  );
}

// Fixed semantic statuses for surfaces that DO have a small closed set
// (quotes, approvals, reconciliation — not trips/bookings).
export type SemanticStatus = "muted" | "info" | "warning" | "success" | "destructive";

const SEMANTIC_COLOR: Record<SemanticStatus, string> = {
  muted: "hsl(var(--muted-foreground))",
  info: "hsl(var(--info))",
  warning: "hsl(var(--warning))",
  success: "hsl(var(--success))",
  destructive: "hsl(var(--destructive))",
};

export function SemanticStatusPill({ status, label, className }: { status: SemanticStatus; label: string; className?: string }) {
  return <StatusPill color={SEMANTIC_COLOR[status]} label={label} className={className} />;
}
