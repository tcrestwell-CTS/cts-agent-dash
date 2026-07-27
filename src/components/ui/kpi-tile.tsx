import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * KpiTile — dashboard/finance KPI cell.
 * Label 10.5px uppercase .13em/700 muted; value 26px/600 tabular-nums; sub 12px muted.
 */

export interface KpiTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}

const TONE_TEXT: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
};

export const KpiTile = React.forwardRef<HTMLDivElement, KpiTileProps>(
  ({ className, label, value, sub, icon, tone = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[11px] border border-border bg-card px-[17px] py-[14px] shadow-card",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-bold uppercase tracking-[.13em] text-muted-foreground">
          {label}
        </p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p
        className={cn(
          "mt-2 text-[26px] font-semibold leading-tight [font-variant-numeric:tabular-nums]",
          TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
      {sub !== undefined && sub !== null && (
        <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>
      )}
    </div>
  ),
);
KpiTile.displayName = "KpiTile";

export function KpiRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}
      {...props}
    />
  );
}