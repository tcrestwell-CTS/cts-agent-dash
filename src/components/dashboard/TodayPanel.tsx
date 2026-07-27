import { useNavigate } from "react-router-dom";
import { Phone, DollarSign, Plane } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/patterns/Panel";
import { cn } from "@/lib/utils";

interface TodayPanelProps {
  followUps: number;
  paymentsDue: number;
  departuresSoon: number;
  loading?: boolean;
}

export function TodayPanel({ followUps, paymentsDue, departuresSoon, loading }: TodayPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
      <CounterCard
        label="Follow-ups"
        description="Proposals & quotes awaiting reply"
        count={loading ? null : followUps}
        icon={Phone}
        onClick={() => navigate("/trips")}
        accent="primary"
      />
      <CounterCard
        label="Commissions Due"
        description="Agency lines awaiting supplier"
        count={loading ? null : paymentsDue}
        icon={DollarSign}
        onClick={() => navigate("/payments-due")}
        accent="accent"
      />
      <CounterCard
        label="Departures ≤14D"
        description="Docs and final balances due"
        count={loading ? null : departuresSoon}
        icon={Plane}
        onClick={() => navigate("/trips")}
        accent="info"
      />
    </div>
  );
}

function CounterCard({
  label,
  description,
  count,
  icon: Icon,
  onClick,
  accent,
}: {
  label: string;
  description: string;
  count: number | null;
  icon: React.ElementType;
  onClick?: () => void;
  accent: "primary" | "accent" | "info";
}) {
  const accentClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    info: "bg-info/10 text-info",
  };

  return (
    <Panel
      onClick={onClick}
      className={cn(
        "flex items-start justify-between p-[18px] cursor-pointer transition-colors hover:bg-muted/30"
      )}
    >
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-[32px] font-semibold leading-none tabular-nums text-foreground">
          {count === null ? <Skeleton className="inline-block h-8 w-10" /> : count}
        </p>
        <p className="mt-2 text-[12.5px] text-muted-foreground">{description}</p>
      </div>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]", accentClasses[accent])}>
        <Icon className="h-5 w-5" />
      </div>
    </Panel>
  );
}
