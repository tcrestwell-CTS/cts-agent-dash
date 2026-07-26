import { useCircleStats } from "@/hooks/useCircleMembers";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/patterns/Panel";

export function CircleFoundersCard() {
  const { stats, isLoading } = useCircleStats();
  const spotsLeft = Math.max(stats.foundingCap - stats.founding, 0);
  const almostFull = stats.founding >= 18;

  return (
    <Panel className={cn("p-[14px]", almostFull && "border-warning/40 bg-warning/5")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className={cn("h-4 w-4", almostFull ? "text-warning" : "text-accent")} />
          <span className="text-[14.5px] font-semibold text-foreground">The Crestwell Circle</span>
        </div>
        <Link
          to="/circle-members"
          className="inline-flex shrink-0 items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          View <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-3 flex items-baseline gap-[14px]">
        <div>
          <p className="text-[20px] font-semibold tabular-nums text-foreground">{isLoading ? "—" : stats.total}</p>
          <p className="text-[11.5px] text-muted-foreground">members</p>
        </div>
        <div>
          <p className="text-[20px] font-semibold tabular-nums text-foreground">{isLoading ? "—" : stats.founding}</p>
          <p className="text-[11.5px] text-muted-foreground">founding</p>
        </div>
        <div>
          <p className="text-[20px] font-semibold tabular-nums text-foreground">{isLoading ? "—" : spotsLeft}</p>
          <p className="text-[11.5px] text-muted-foreground">spots left</p>
        </div>
      </div>
      {almostFull && (
        <p className="mt-2 text-[11.5px] font-medium text-warning">
          Almost full — {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} remaining
        </p>
      )}
    </Panel>
  );
}
