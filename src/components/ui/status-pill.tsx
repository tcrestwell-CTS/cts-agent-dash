import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StatusPill — canonical pill for trip / booking / payment status.
 * font 11.5px/600, padding 2px 9px, radius 20px, background = color at 15% alpha, text = full color.
 */

export type TripStatusKey =
  | "draft"
  | "quoted"
  | "proposal_sent"
  | "booked"
  | "confirmed"
  | "completed";

export type StatusTone =
  | TripStatusKey
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "neutral";

// HSL values (space-separated triplets) so we can compose alpha with hsl(... / 0.15).
const TONE_HSL: Record<StatusTone, string> = {
  draft: "213 20% 50%",
  quoted: "210 90% 50%",
  proposal_sent: "38 92% 45%",
  booked: "43 50% 46%",
  confirmed: "152 60% 40%",
  completed: "213 20% 50%",
  success: "152 60% 40%",
  warning: "38 92% 45%",
  danger: "0 65% 45%",
  info: "210 90% 50%",
  muted: "213 20% 50%",
  neutral: "213 20% 50%",
};

const TRIP_STATUS_LABEL: Record<TripStatusKey, string> = {
  draft: "Draft",
  quoted: "Quoted",
  proposal_sent: "Proposal sent",
  booked: "Booked",
  confirmed: "Confirmed",
  completed: "Completed",
};

export function getTripStatusLabel(status: string): string {
  return TRIP_STATUS_LABEL[status as TripStatusKey] ?? status;
}

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  /** Convenience: pass a trip status string and the tone + label are derived. */
  status?: string;
  dot?: boolean;
}

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, tone, status, dot = false, style, children, ...props }, ref) => {
    const resolvedTone: StatusTone = tone ?? ((status as StatusTone) || "neutral");
    const hsl = TONE_HSL[resolvedTone] ?? TONE_HSL.neutral;
    const label = children ?? (status ? getTripStatusLabel(status) : null);
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[20px] px-[9px] py-[2px] text-[11.5px] font-semibold leading-[1.35]",
          className,
        )}
        style={{
          backgroundColor: `hsl(${hsl} / 0.15)`,
          color: `hsl(${hsl})`,
          ...style,
        }}
        {...props}
      >
        {dot && (
          <span
            className="h-[6px] w-[6px] rounded-full"
            style={{ backgroundColor: `hsl(${hsl})` }}
          />
        )}
        {label}
      </span>
    );
  },
);
StatusPill.displayName = "StatusPill";

export { TONE_HSL as STATUS_PILL_HSL };