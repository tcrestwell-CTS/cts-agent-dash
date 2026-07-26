import { useNavigate } from "react-router-dom";
import { Phone, CreditCard, Plane } from "lucide-react";
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
    <div>
      <h2 className="text-[10.5px] font-bold uppercase tracking-[.13em] text-muted-foreground mb-3">Today</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
        <CounterCard label="Follow Ups" count={loading ? null : followUps} icon={Phone} onClick={() => navigate("/trips")} urgent={followUps > 0} />
        <CounterCard label="Payments Due" count={loading ? null : paymentsDue} icon={CreditCard} onClick={() => navigate("/payments-due")} urgent={paymentsDue > 0} />
        <CounterCard label="Departures Soon" count={loading ? null : departuresSoon} icon={Plane} onClick={() => navigate("/trips")} urgent={departuresSoon >= 3} />
      </div>
    </div>
  );
}

function CounterCard({
  label,
  count,
  icon: Icon,
  onClick,
  urgent,
}: {
  label: string;
  count: number | null;
  icon: React.ElementType;
  onClick?: () => void;
  urgent?: boolean;
}) {
  return (
    <Panel
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-[14px] cursor-pointer transition-colors hover:bg-muted/30",
        urgent && "border-destructive/30 bg-destructive/5"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px]",
          urgent ? "bg-destructive/10" : "bg-primary/10"
        )}
      >
        <Icon className={cn("h-5 w-5", urgent ? "text-destructive" : "text-primary")} />
      </div>
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-foreground">
          {count === null ? <Skeleton className="inline-block h-7 w-10" /> : count}
        </p>
      </div>
    </Panel>
  );
}
