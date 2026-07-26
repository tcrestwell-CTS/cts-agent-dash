import { useNavigate } from "react-router-dom";
import { Send, Calendar, CheckCircle2 } from "lucide-react";
import { Panel } from "@/components/patterns/Panel";
import { Skeleton } from "@/components/ui/skeleton";

interface PipelineData {
  quotes: number;
  pending: number;
  confirmed: number;
}

interface PipelineCardsProps {
  data: PipelineData;
  loading?: boolean;
}

const items = [
  { key: "quotes" as const, title: "Quotes Sent", icon: Send, route: "/trips" },
  { key: "pending" as const, title: "Pending Bookings", icon: Calendar, route: "/bookings" },
  { key: "confirmed" as const, title: "Confirmed Trips", icon: CheckCircle2, route: "/trips" },
];

export default function PipelineCards({ data, loading }: PipelineCardsProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
      {items.map(({ key, title, icon: Icon, route }) => (
        <Panel
          key={key}
          onClick={() => navigate(route)}
          className="flex cursor-pointer items-center gap-3 p-[14px] transition-colors hover:bg-muted/40"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-accent/10">
            <Icon className="h-4 w-4 text-accent" />
          </div>
          <div>
            <p className="text-[12.5px] font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="mt-1 h-6 w-8" />
            ) : (
              <p className="text-[20px] font-semibold tabular-nums text-foreground">{data[key]}</p>
            )}
          </div>
        </Panel>
      ))}
    </div>
  );
}
