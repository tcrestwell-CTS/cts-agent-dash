import { Skeleton } from "@/components/ui/skeleton";
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
    { key: "sent" as const, label: "Sent", value: sent, pct: 100 },
    { key: "viewed" as const, label: "Viewed", value: viewed, pct: pct(viewed, sent) },
    { key: "approved" as const, label: "Approved", value: approved, pct: pct(approved, sent) },
  ];

  return (
    <Panel>
      <PanelHeader
        title="Quote funnel"
        subtitle="Last 90 days"
      />
      <PanelBody className="space-y-4">
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <>
            {stages.map(({ label, value, pct: stagePct }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="font-medium text-foreground">{label}</span>
                  <span className="tabular-nums font-semibold text-foreground">{value}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, stagePct)}%` }}
                  />
                </div>
              </div>
            ))}
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
