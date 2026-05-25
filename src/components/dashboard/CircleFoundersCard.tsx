import { useCircleStats } from "@/hooks/useCircleMembers";
import { Card } from "@/components/ui/card";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function CircleFoundersCard() {
  const { stats, isLoading } = useCircleStats();
  const spotsLeft = Math.max(stats.foundingCap - stats.founding, 0);
  const almostFull = stats.founding >= 18;

  return (
    <Card className={cn("p-4", almostFull && "border-amber-400/50 bg-amber-50/40")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">The Crestwell Circle</span>
        </div>
        <Link to="/circle-members" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          View <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-3 flex items-baseline gap-4 text-sm">
        <div><p className="text-xl font-semibold">{isLoading ? "—" : stats.total}</p><p className="text-xs text-muted-foreground">members</p></div>
        <div><p className="text-xl font-semibold">{isLoading ? "—" : stats.founding}</p><p className="text-xs text-muted-foreground">founding</p></div>
        <div><p className="text-xl font-semibold">{isLoading ? "—" : spotsLeft}</p><p className="text-xs text-muted-foreground">spots left</p></div>
      </div>
      {almostFull && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          Almost full — {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} remaining
        </p>
      )}
    </Card>
  );
}