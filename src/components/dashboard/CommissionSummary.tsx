import { TrendingUp, DollarSign } from "lucide-react";

const commissionData = [
  { month: "Jan", amount: 4200 },
  { month: "Feb", amount: 5800 },
  { month: "Mar", amount: 3900 },
  { month: "Apr", amount: 6200 },
  { month: "May", amount: 7100 },
  { month: "Jun", amount: 5400 },
];

const maxAmount = Math.max(...commissionData.map((d) => d.amount));

export function CommissionSummary() {
  const totalCommission = commissionData.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">
            Commission Earnings
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Last 6 months</p>
        </div>
        <div className="flex items-center gap-2 text-success">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-medium">+12.5%</span>
        </div>
      </div>

      {/* Mini chart */}
      <div className="flex items-end justify-between gap-2 h-24 mb-4">
        {commissionData.map((data) => (
          <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
            <div
              className="w-full bg-primary/20 rounded-t transition-all hover:bg-primary/30"
              style={{ height: `${(data.amount / maxAmount) * 100}%` }}
            >
              <div
                className="w-full bg-primary rounded-t"
                style={{ height: "100%" }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{data.month}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <span className="text-sm text-muted-foreground">Total Earned</span>
        <div className="flex items-center gap-1">
          <DollarSign className="h-4 w-4 text-success" />
          <span className="text-xl font-semibold text-card-foreground">
            {totalCommission.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
