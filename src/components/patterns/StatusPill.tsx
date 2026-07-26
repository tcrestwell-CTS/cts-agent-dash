import { cn } from "@/lib/utils";

export type TripStatus = "draft" | "quoted" | "proposal_sent" | "booked" | "confirmed" | "completed";

// Trip status color map from the UI refresh handoff. quoted/proposal_sent/confirmed
// reuse the info/warning/success tokens (so they adapt per theme); draft/booked/completed
// are bespoke hues the handoff specifies as fixed values in both themes.
const STATUS_COLOR: Record<TripStatus, string> = {
  draft: "213 20% 50%",
  quoted: "hsl(var(--info))",
  proposal_sent: "hsl(var(--warning))",
  booked: "43 50% 46%",
  confirmed: "hsl(var(--success))",
  completed: "213 20% 50%",
};

export const STATUS_LABEL: Record<TripStatus, string> = {
  draft: "Draft",
  quoted: "Quoted",
  proposal_sent: "Proposal sent",
  booked: "Booked",
  confirmed: "Confirmed",
  completed: "Completed",
};

interface StatusPillProps {
  status: TripStatus;
  label?: string;
  className?: string;
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  const raw = STATUS_COLOR[status] ?? STATUS_COLOR.draft;
  const color = raw.startsWith("hsl(") ? raw : `hsl(${raw})`;
  const bg = raw.startsWith("hsl(var(") ? raw.replace(")", " / 0.15)") : `hsl(${raw} / 0.15)`;

  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-[9px] py-[2px] text-[11.5px] font-semibold", className)}
      style={{ color, background: bg }}
    >
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}
