import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { toast } from "sonner";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type TBAccount = {
  account: string;
  account_type: string;
  debit: number;
  credit: number;
  net: number;
};

type TBResponse = {
  cached?: boolean;
  fetched_at?: string;
  error?: string;
  detail?: string;
  report_name?: string;
  start_date?: string;
  end_date?: string;
  period_year?: number;
  period_month?: number;
  accounts?: TBAccount[];
  totals?: { debit: number; credit: number; difference: number };
};

// Normalize QBO section labels into the five accounting groups.
const GROUPS = ["Assets", "Liabilities", "Equity", "Income", "Expenses"] as const;
type GroupKey = typeof GROUPS[number];

const groupFor = (qboType: string): GroupKey | "Other" => {
  const t = (qboType || "").toLowerCase();
  if (t.includes("asset")) return "Assets";
  if (t.includes("liab")) return "Liabilities";
  if (t.includes("equity")) return "Equity";
  if (t.includes("income") || t.includes("revenue")) return "Income";
  if (t.includes("expense") || t.includes("cogs") || t.includes("cost")) return "Expenses";
  return "Other";
};

async function fetchTrialBalance(year: number, month: number, refresh = false): Promise<TBResponse> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=trial-balance&year=${year}&month=${month}${refresh ? "&refresh=1" : ""}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error || `Trial balance request failed (${resp.status})`);
  }
  return json;
}

export default function BookkeeperTrialBalance() {
  const logAction = useLogBookkeeperAction();
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    logAction("view", "bookkeeper_trial_balance", { year, month });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // Check QBO connection (for any of the user's connections).
  const { data: qboConnection, isLoading: connLoading } = useQuery({
    queryKey: ["qbo-connection-any"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("qbo_connections")
        .select("id, is_active, company_name")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["trial-balance", year, month],
    enabled: !!qboConnection,
    queryFn: () => fetchTrialBalance(year, month, false),
    staleTime: 4 * 60 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await fetchTrialBalance(year, month, true);
      queryClient.setQueryData(["trial-balance", year, month], fresh);
      logAction("refresh", "bookkeeper_trial_balance", { year, month });
      toast.success("Trial balance refreshed from QuickBooks");
    } catch (e: any) {
      toast.error(e?.message || "Failed to refresh trial balance");
    } finally {
      setRefreshing(false);
    }
  };

  const grouped = useMemo(() => {
    const map: Record<GroupKey | "Other", TBAccount[]> = {
      Assets: [], Liabilities: [], Equity: [], Income: [], Expenses: [], Other: [],
    };
    (data?.accounts ?? []).forEach((a) => {
      map[groupFor(a.account_type)].push(a);
    });
    return map;
  }, [data]);

  const totals = data?.totals;
  const outOfBalance =
    totals && Math.abs((totals.debit ?? 0) - (totals.credit ?? 0)) > 0.01;

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) arr.push(y);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">
              Trial Balance — {MONTHS[month - 1]} {year}
            </h1>
            <p className="text-muted-foreground text-sm">
              Pulled from QuickBooks Online{data?.fetched_at ? ` · last fetched ${new Date(data.fetched_at).toLocaleString()}` : ""}
              {data?.cached ? " · cached" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v, 10))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || !qboConnection}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh from QBO
              </Button>
            )}
          </div>
        </div>

        {/* Connection / error / empty states */}
        {!connLoading && !qboConnection && (
          <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
            <CardContent className="p-6">
              <div className="font-medium">QuickBooks Online is not connected</div>
              <div className="text-sm text-muted-foreground mt-1">
                Connect QuickBooks Online in Settings to view the trial balance.
              </div>
            </CardContent>
          </Card>
        )}

        {qboConnection && error && (
          <Card className="border-destructive/40">
            <CardContent className="p-4 text-sm text-destructive">
              {(error as Error).message}
            </CardContent>
          </Card>
        )}

        {qboConnection && (isLoading || isFetching) && !data && (
          <Skeleton className="h-96 w-full" />
        )}

        {qboConnection && data && (
          <>
            {outOfBalance && (
              <Card className="border-destructive/60 bg-destructive/5">
                <CardContent className="p-4 flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Out of balance</span>
                  <span className="text-sm">
                    Debits {fmt(totals!.debit)} ≠ Credits {fmt(totals!.credit)} (diff {fmt(totals!.difference)})
                  </span>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(["Assets", "Liabilities", "Equity", "Income", "Expenses", "Other"] as const).map((group) => {
                      const rows = grouped[group];
                      if (!rows || rows.length === 0) return null;
                      const subDebit = rows.reduce((s, r) => s + r.debit, 0);
                      const subCredit = rows.reduce((s, r) => s + r.credit, 0);
                      const subNet = subDebit - subCredit;
                      return (
                        <>
                          <TableRow key={`${group}-header`} className="bg-muted/40">
                            <TableCell colSpan={5} className="font-semibold text-sm uppercase tracking-wide">
                              {group}
                            </TableCell>
                          </TableRow>
                          {rows.map((r, i) => (
                            <TableRow key={`${group}-${i}`}>
                              <TableCell>{r.account}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-normal">{r.account_type}</Badge>
                              </TableCell>
                              <TableCell className="text-right">{r.debit ? fmt(r.debit) : ""}</TableCell>
                              <TableCell className="text-right">{r.credit ? fmt(r.credit) : ""}</TableCell>
                              <TableCell className="text-right font-medium">{fmt(r.net)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow key={`${group}-sub`} className="border-t border-border/60">
                            <TableCell className="font-semibold">Subtotal — {group}</TableCell>
                            <TableCell />
                            <TableCell className="text-right font-semibold">{fmt(subDebit)}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(subCredit)}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(subNet)}</TableCell>
                          </TableRow>
                        </>
                      );
                    })}
                    {totals && (
                      <TableRow className="bg-muted">
                        <TableCell className="font-bold">Grand total</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-bold">{fmt(totals.debit)}</TableCell>
                        <TableCell className="text-right font-bold">{fmt(totals.credit)}</TableCell>
                        <TableCell className={`text-right font-bold ${outOfBalance ? "text-destructive" : ""}`}>
                          {fmt(totals.difference)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {(!data.accounts || data.accounts.length === 0) && (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No accounts returned by QuickBooks for this period.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}