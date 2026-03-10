import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp } from "lucide-react";

interface BusinessSnapshotProps {
  revenueMTD: number;
  totalClients: number;
  conversionRate: number;
  loading?: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

export function BusinessSnapshot({ revenueMTD, totalClients, conversionRate, loading }: BusinessSnapshotProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Business Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Revenue (MTD)
            </div>
            <span className="text-lg font-semibold text-foreground">
              {loading ? "..." : formatCurrency(revenueMTD)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Clients
            </div>
            <span className="text-lg font-semibold text-foreground">
              {loading ? "..." : totalClients}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Conversion
            </div>
            <span className="text-lg font-semibold text-foreground">
              {loading ? "..." : `${conversionRate}%`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
