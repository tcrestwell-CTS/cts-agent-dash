import { Skeleton } from "@/components/ui/skeleton";
import { Send, Eye, CheckCircle2, Sparkles } from "lucide-react";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";

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
    <Panel>
      <PanelHeader
        title="Quote Conversion"
        actions={
          !loading && (
            <span className="text-[12.5px] font-semibold text-foreground">
              {overallConversion}% Sent → Booked
            </span>
          )
        }
      />
      <PanelBody className="space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          stages.map(({ key, label, value, icon: Icon, pct: stagePct }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[13.5px]">
                <div className="flex items-center gap-2 text-foreground">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{label}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="tabular-nums font-medium text-foreground">{value}</span>
                  <span className="w-10 text-right text-[12px] tabular-nums">{stagePct}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, stagePct)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </PanelBody>
    </Panel>
  );
}
