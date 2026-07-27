import { DollarSign, Users, TrendingUp, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface BusinessSnapshotProps {
  revenueMTD: number;
  totalClients: number;
  conversionRate: number;
  avgBookingValue?: number;
  loading?: boolean;
}

const stats = [
  { key: "revenue" as const, label: "Revenue MTD", icon: DollarSign, format: (v: number) => formatCurrency(v) },
  { key: "clients" as const, label: "Clients", icon: Users, format: (v: number) => String(v) },
  { key: "conversion" as const, label: "Conversion", icon: TrendingUp, format: (v: number) => `${v}%` },
  { key: "avg" as const, label: "Avg Booking", icon: Receipt, format: (v: number) => formatCurrency(v) },
];

export function BusinessSnapshot({ revenueMTD, totalClients, conversionRate, avgBookingValue = 0, loading }: BusinessSnapshotProps) {
  const values = {
    revenue: revenueMTD,
    clients: totalClients,
    conversion: conversionRate,
    avg: avgBookingValue,
  };

  return (
    <div className="flex flex-wrap items-end gap-6 sm:gap-8">
      {stats.map(({ key, label, icon: Icon, format }) => (
        <div key={key} className="flex flex-col items-start">
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[.13em] text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </div>
          {loading ? (
            <Skeleton className="mt-1.5 h-6 w-14" />
          ) : (
            <span className="mt-1 text-[18px] font-semibold tabular-nums text-foreground">{format(values[key])}</span>
          )}
        </div>
      ))}
    </div>
  );
}
