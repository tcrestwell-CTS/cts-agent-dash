import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ShieldAlert, AlertTriangle, Filter, RefreshCw } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useIsAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface PaymentIpLog {
  id: string;
  created_at: string;
  page: string | null;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  amount_cents: number | null;
  currency: string | null;
  outcome: string | null;
  last_four: string | null;
  client_id: string | null;
  booking_id: string | null;
  trip_id: string | null;
  customer_email: string | null;
  stripe_payment_intent_id: string | null;
  stripe_payment_method_id: string | null;
  risk_flags: string[] | null;
  risk_score: number | null;
  flagged: boolean | null;
  metadata: Record<string, unknown> | null;
}

const OUTCOMES = ["attempted", "succeeded", "failed", "blocked"] as const;
const PAGE_SIZE = 25;

function outcomeVariant(outcome: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (outcome) {
    case "succeeded": return "default";
    case "failed": return "destructive";
    case "blocked": return "destructive";
    case "attempted": return "secondary";
    default: return "outline";
  }
}

function formatAmount(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const ccy = (currency || "usd").toUpperCase();
  return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy }).format(cents / 100);
}

export default function PaymentSecurity() {
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  const [pageFilter, setPageFilter] = useState<string>("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(0);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["payment-ip-logs", pageFilter, outcomeFilter, countryFilter, startDate, endDate, page],
    queryFn: async () => {
      let q = supabase
        .from("payment_ip_logs" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (pageFilter.trim()) q = q.ilike("page", `%${pageFilter.trim()}%`);
      if (outcomeFilter !== "all") q = q.eq("outcome", outcomeFilter);
      if (countryFilter.trim()) q = q.eq("country", countryFilter.trim().toUpperCase());
      if (startDate) q = q.gte("created_at", new Date(startDate).toISOString());
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data || []) as unknown as PaymentIpLog[], count: count ?? 0 };
    },
    enabled: !!isAdmin,
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const flaggedCount = useMemo(() => rows.filter((r) => r.flagged).length, [rows]);

  if (adminLoading) {
    return (
      <DashboardLayout>
        <div className="p-6"><Skeleton className="h-96 w-full" /></div>
      </DashboardLayout>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Payment Security</h1>
              <p className="text-sm text-muted-foreground">
                IP-logged audit trail across every payment-touching CRM endpoint.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
            <CardDescription>
              Showing {rows.length} of {total} matching events · {flaggedCount} flagged on this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Page / endpoint</label>
                <Input
                  placeholder="create-payment-intent"
                  value={pageFilter}
                  onChange={(e) => { setPage(0); setPageFilter(e.target.value); }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Outcome</label>
                <Select value={outcomeFilter} onValueChange={(v) => { setPage(0); setOutcomeFilter(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All outcomes</SelectItem>
                    {OUTCOMES.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Country (ISO)</label>
                <Input
                  placeholder="US"
                  maxLength={3}
                  value={countryFilter}
                  onChange={(e) => { setPage(0); setCountryFilter(e.target.value); }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setPage(0); setStartDate(e.target.value); }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setPage(0); setEndDate(e.target.value); }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Events</CardTitle>
            <CardDescription>Flagged rows are tinted red; hover a flag badge for the rule that fired.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-6">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No payment events match these filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Last 4</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.id}
                        className={r.flagged ? "bg-destructive/10 hover:bg-destructive/15" : ""}
                      >
                        <TableCell className="whitespace-nowrap text-xs">
                          {format(new Date(r.created_at), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.page || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.ip_address || "—"}</TableCell>
                        <TableCell className="text-xs">{r.country || "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {formatAmount(r.amount_cents, r.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={outcomeVariant(r.outcome)} className="capitalize">
                            {r.outcome || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.last_four ? `••${r.last_four}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.client_id ? (
                            <a
                              href={`/contacts/${r.client_id}`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              View
                            </a>
                          ) : r.customer_email ? (
                            <span className="text-muted-foreground">{r.customer_email}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {r.risk_flags && r.risk_flags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.risk_flags.map((f) => (
                                <Badge
                                  key={f}
                                  variant="destructive"
                                  className="text-[10px]"
                                  title={`Risk score: ${r.risk_score ?? 0}`}
                                >
                                  <AlertTriangle className="mr-1 h-3 w-3" /> {f}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between border-t p-3">
              <div className="text-xs text-muted-foreground">
                Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={page === 0 || isFetching}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={(page + 1) * PAGE_SIZE >= total || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}