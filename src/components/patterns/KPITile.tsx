import { cn } from "@/lib/utils";
import { Panel } from "./Panel";

interface KPITileProps {
  label: string;
  value: React.ReactNode;
  subline?: React.ReactNode;
  className?: string;
}

export function KPITile({ label, value, subline, className }: KPITileProps) {
  return (
    <Panel className={cn("p-[14px]", className)}>
      <p className="text-[10.5px] font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[26px] font-semibold tabular-nums text-foreground">{value}</p>
      {subline && <p className="mt-0.5 text-[12px] text-muted-foreground">{subline}</p>}
    </Panel>
  );
}

export function KPIGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4", className)}
      {...props}
    />
  );
}
