import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyData {
  month: string;
  amount: number;
}

export function CommissionSummary() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    try {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("total_amount, depart_date, status")
        .in("status", ["confirmed", "completed"]);

      if (!bookings || bookings.length === 0) {
        setMonthlyData([]);
        setTotalRevenue(0);
        setLoading(false);
        return;
      }

      // Group by month
      const monthlyTotals: Record<string, number> = {};
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      bookings.forEach((booking) => {
        const date = new Date(booking.depart_date);
        const monthKey = months[date.getMonth()];
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + (booking.total_amount || 0);
      });

      // Get last 6 months with data or current months
      const currentMonth = new Date().getMonth();
      const last6Months: MonthlyData[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12;
        const monthName = months[monthIndex];
        last6Months.push({
          month: monthName,
          amount: monthlyTotals[monthName] || 0,
        });
      }

      setMonthlyData(last6Months);
      setTotalRevenue(bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0));
    } catch (error) {
      console.error("Error fetching revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  const maxAmount = Math.max(...monthlyData.map((d) => d.amount), 1);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">
            Revenue by Month
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Last 6 months</p>
        </div>
        {totalRevenue > 0 && (
          <div className="flex items-center gap-2 text-success">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">Active</span>
          </div>
        )}
      </div>

      {/* Mini chart */}
      {monthlyData.length > 0 && monthlyData.some((d) => d.amount > 0) ? (
        <div className="flex items-end justify-between gap-2 h-24 mb-4">
          {monthlyData.map((data) => (
            <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full bg-primary/20 rounded-t transition-all hover:bg-primary/30 relative group"
                style={{ height: `${Math.max((data.amount / maxAmount) * 100, 4)}%` }}
              >
                <div
                  className="w-full bg-primary rounded-t"
                  style={{ height: "100%" }}
                />
                {data.amount > 0 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card px-2 py-1 rounded shadow text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    ${formatCurrency(data.amount)}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{data.month}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-24 mb-4 text-muted-foreground text-sm">
          No revenue data yet
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <span className="text-sm text-muted-foreground">Total Revenue</span>
        <div className="flex items-center gap-1">
          <DollarSign className="h-4 w-4 text-success" />
          <span className="text-xl font-semibold text-card-foreground">
            {formatCurrency(totalRevenue)}
          </span>
        </div>
      </div>
    </div>
  );
}
