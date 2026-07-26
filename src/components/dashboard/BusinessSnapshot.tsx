import { DollarSign, Users, TrendingUp, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BusinessSnapshotProps {
  revenueMTD: number;
  totalClients: number;
  conversionRate: number;
  avgBookingValue?: number;
  loading?: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

const stats = [
  { key: "revenue" as const, label: "Revenue MTD", icon: DollarSign },
  { key: "avg" as const, label: "Avg Booking", icon: Receipt },
  { key: "clients" as const, label: "Clients", icon: Users },
  { key: "conversion" as const, label: "Conversion", icon: TrendingUp },
];

export function BusinessSnapshot({ revenueMTD, totalClients, conversionRate, avgBookingValue = 0, loading }: BusinessSnapshotProps) {
  const values = {
    revenue: formatCurrency(revenueMTD),
    avg: formatCurrency(avgBookingValue),
    clients: String(totalClients),
    conversion: `${conversionRate}%`,
  };

  return (
    <div className="flex flex-wrap items-center gap-y-2 divide-x divide-border">
      {stats.map(({ key, label, icon: Icon }) => (
        <div key={key} className="flex items-center gap-2 px-4 first:pl-0 last:pr-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-[12.5px] text-muted-foreground">{label}</span>
          {loading ? (
            <Skeleton className="h-4 w-10" />
          ) : (
            <span className="text-[13.5px] font-semibold tabular-nums text-foreground">{values[key]}</span>
          )}
        </div>
      ))}
    </div>
  );
}
