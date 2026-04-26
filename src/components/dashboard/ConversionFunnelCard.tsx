import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Eye, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversionFunnelCardProps {
  sent: number;
  viewed: number;
  approved: number;
  booked: number;
  loading?: boolean;
}

const pct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

export function ConversionFunnelCard({ sent, viewed, approved, booked, loading }: ConversionFunnelCardProps) {
  const stages = [
    { key: "sent", label: "Sent", value: sent, icon: Send, pct: 100 },
    { key: "viewed", label: "Viewed", value: viewed, icon: Eye, pct: pct(viewed, sent) },
    { key: "approved", label: "Approved", value: approved, icon: CheckCircle2, pct: pct(approved, sent) },
    { key: "booked", label: "Booked", value: booked, icon: Sparkles, pct: pct(booked, sent) },
  ];

  const overallConversion = pct(booked, sent);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quote Conversion
        </CardTitle>
        {!loading && (
          <span className="text-xs font-semibold text-foreground">
            {overallConversion}% Sent → Booked
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          stages.map(({ key, label, value, icon: Icon, pct: stagePct }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{label}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="tabular-nums font-medium text-foreground">{value}</span>
                  <span className="tabular-nums text-xs w-10 text-right">{stagePct}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full bg-primary transition-all")}
                  style={{ width: `${Math.min(100, stagePct)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}