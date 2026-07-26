import { useMemo, useState } from "react";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, startOfYear, subDays, subMonths, eachDayOfInterval, eachMonthOfInterval } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";

type RangeKey = "30d" | "90d" | "mtd" | "ytd" | "12m";

function getRange(key: RangeKey): { start: Date; end: Date; bucket: "day" | "month" } {
  const end = new Date();
  switch (key) {
    case "30d": return { start: subDays(end, 29), end, bucket: "day" };
    case "90d": return { start: subDays(end, 89), end, bucket: "day" };
    case "mtd": return { start: startOfMonth(end), end, bucket: "day" };
    case "ytd": return { start: startOfYear(end), end, bucket: "month" };
    case "12m": return { start: subMonths(startOfMonth(end), 11), end, bucket: "month" };
  }
}

const fmtCurrency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function StripeFeesTrendChart() {
  const [range, setRange] = useState<RangeKey>("90d");
  const { start, end, bucket } = useMemo(() => getRange(range), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["bookkeeper-stripe-fees-trend", range],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stripe_payouts")
        .select("arrival_date, amount, fee_total")
        .gte("arrival_date", format(start, "yyyy-MM-dd"))
        .lte("arrival_date", format(end, "yyyy-MM-dd"));
      if (error) throw error;
      return data ?? [];
    },
  });

  const chartData = useMemo(() => {
    const buckets = new Map<string, { label: string; fees: number; gross: number }>();
    if (bucket === "day") {
      for (const d of eachDayOfInterval({ start, end })) {
        const k = format(d, "yyyy-MM-dd");
        buckets.set(k, { label: format(d, "MMM d"), fees: 0, gross: 0 });
      }
    } else {
      for (const d of eachMonthOfInterval({ start: startOfMonth(start), end })) {
        const k = format(d, "yyyy-MM");
        buckets.set(k, { label: format(d, "MMM yy"), fees: 0, gross: 0 });
      }
    }
    for (const r of (data ?? []) as any[]) {
      if (!r.arrival_date) continue;
      const k = bucket === "day" ? r.arrival_date : String(r.arrival_date).slice(0, 7);
      const b = buckets.get(k);
      if (!b) continue;
      b.fees += Number(r.fee_total || 0);
      b.gross += Number(r.amount || 0);
    }
    return Array.from(buckets.values());
  }, [data, bucket, start, end]);

  const totals = useMemo(() => {
    const fees = chartData.reduce((s, x) => s + x.fees, 0);
    const gross = chartData.reduce((s, x) => s + x.gross, 0);
    const rate = gross > 0 ? (fees / gross) * 100 : 0;
    return { fees, gross, rate };
  }, [chartData]);

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Stripe Fees Trend
          </span>
        }
        subtitle={`${fmtCurrency(totals.fees)} in fees on ${fmtCurrency(totals.gross)} gross · ${totals.rate.toFixed(2)}% effective`}
        actions={
          <ToggleGroup
            type="single"
            size="sm"
            value={range}
            onValueChange={(v) => v && setRange(v as RangeKey)}
          >
            <ToggleGroupItem value="30d" className="text-[13px]">30D</ToggleGroupItem>
            <ToggleGroupItem value="90d" className="text-[13px]">90D</ToggleGroupItem>
            <ToggleGroupItem value="mtd" className="text-[13px]">MTD</ToggleGroupItem>
            <ToggleGroupItem value="ytd" className="text-[13px]">YTD</ToggleGroupItem>
            <ToggleGroupItem value="12m" className="text-[13px]">12M</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <PanelBody>
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-[9px]" />
        ) : chartData.length === 0 ? (
          <div className="py-12 text-center text-[13.5px] text-muted-foreground">No payout data in this range.</div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtCurrency(Number(v))} width={70} />
                <Tooltip
                  formatter={(v: any, name) => [fmtCurrency(Number(v)), name === "fees" ? "Fees" : "Gross"]}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="gross" name="Gross" stroke="hsl(var(--muted-foreground))" fill="url(#grossGrad)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="fees" name="Fees" stroke="hsl(var(--primary))" fill="url(#feeGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}