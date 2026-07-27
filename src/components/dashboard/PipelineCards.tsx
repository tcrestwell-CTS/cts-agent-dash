import { useNavigate } from "react-router-dom";
import { Send, FileCheck, CheckCircle2 } from "lucide-react";
import { Panel } from "@/components/patterns/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface PipelineData {
  quotes: number;
  quotesValue: number;
  proposals: number;
  proposalsValue: number;
  confirmed: number;
  confirmedValue: number;
}

interface PipelineCardsProps {
  data: PipelineData;
  loading?: boolean;
}

const items = [
  { key: "quotes" as const, title: "Quotes", route: "/trips", color: "text-info", bg: "bg-info/10", bar: "bg-info" },
  { key: "proposals" as const, title: "Proposals sent", route: "/trips", color: "text-warning", bg: "bg-warning/10", bar: "bg-warning" },
  { key: "confirmed" as const, title: "Confirmed", route: "/trips", color: "text-success", bg: "bg-success/10", bar: "bg-success" },
];

export default function PipelineCards({ data, loading }: PipelineCardsProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
      {items.map(({ key, title, route, color, bg, bar }) => {
        const count = data[key === "quotes" ? "quotes" : key === "proposals" ? "proposals" : "confirmed"];
        const value = data[key === "quotes" ? "quotesValue" : key === "proposals" ? "proposalsValue" : "confirmedValue"];
        return (
          <Panel
            key={key}
            onClick={() => navigate(route)}
            className="flex cursor-pointer flex-col justify-between p-[18px] transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className={`text-[13px] font-medium ${color}`}>{title}</p>
                {loading ? (
                  <Skeleton className="mt-1 h-8 w-10" />
                ) : (
                  <p className="text-[28px] font-semibold tabular-nums text-foreground leading-none">{count}</p>
                )}
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] ${bg}`}>
                {key === "quotes" && <Send className={`h-4 w-4 ${color}`} />}
                {key === "proposals" && <FileCheck className={`h-4 w-4 ${color}`} />}
                {key === "confirmed" && <CheckCircle2 className={`h-4 w-4 ${color}`} />}
              </div>
            </div>
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <p className="text-[13px] font-semibold tabular-nums text-foreground">{formatCurrency(value)}</p>
              )}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${bar} transition-all`} style={{ width: "100%" }} />
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
