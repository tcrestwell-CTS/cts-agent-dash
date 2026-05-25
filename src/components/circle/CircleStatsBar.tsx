import { Sparkles, Users, TrendingUp, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCircleStats } from "@/hooks/useCircleMembers";

export function CircleStatsBar() {
  const { stats, isLoading } = useCircleStats();

  const items = [
    { label: "Total Members", value: stats.total, icon: Users },
    {
      label: "Founding Members",
      value: `${stats.founding} / ${stats.foundingCap}`,
      icon: Sparkles,
      highlight: stats.founding >= 18,
    },
    { label: "Active This Month", value: stats.activeThisMonth, icon: TrendingUp },
    {
      label: "Trial Ending Soon",
      value: stats.trialEndingSoon,
      icon: AlertCircle,
      highlight: stats.trialEndingSoon > 0,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{it.label}</p>
            <it.icon
              className={
                "h-4 w-4 " +
                (it.highlight ? "text-amber-500" : "text-muted-foreground")
              }
            />
          </div>
          <p className="mt-2 text-2xl font-semibold">
            {isLoading ? "—" : it.value}
          </p>
        </Card>
      ))}
    </div>
  );
}