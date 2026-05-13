import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { exportToCSV } from "@/lib/csvExport";
import { toast } from "sonner";
import { format } from "date-fns";

type Decision = "pending" | "linked" | "refunded" | "written_off" | "skip";

interface UnmatchedRow {
  qbo_payment_id: string;
  amount: number;
  payment_date: string | null;
  customer_name: string;
  qbo_customer_id: string | null;
  crm_payment_id: string | null;
  trip_name: string | null;
  client_name: string | null;
  payment_ref_num: string | null;
  synced_at: string | null;
  decision: Decision;
  target_qbo_invoice_id: string | null;
  notes: string | null;
  reviewed_at: string | null;
}

const DECISIONS: { value: Decision; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "linked", label: "Linked to invoice" },
  { value: "refunded", label: "Refunded" },
  { value: "written_off", label: "Written off" },
  { value: "skip", label: "Skip / Ignore" },
];

function decisionBadge(d: Decision) {
  const map: Record<Decision, string> = {
    pending: "bg-muted text-muted-foreground",
    linked: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    refunded: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    written_off: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    skip: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  };
  return <Badge variant="outline" className={map[d]}>{DECISIONS.find((x) => x.value === d)?.label}</Badge>;
}

export default function QboUnmatchedReview() {
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [linkType, setLinkType] = useState<"all" | "orphan" | "crm_linked">("all");
  const [decisionFilter, setDecisionFilter] = useState<"all" | Decision>("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [detail, setDetail] = useState<UnmatchedRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["qbo-unmatched-review"],
    enabled: !!isAdmin,
    queryFn: async (): Promise<UnmatchedRow[]> => {
      const { data: pays, error } = await supabase
        .from("qbo_payments")
        .select("qbo_id, total_amt, txn_date, qbo_customer_id, crm_payment_id, payment_ref_num, raw_payload, synced_at")
        .is("qbo_invoice_id", null)
        .order("txn_date", { ascending: false });
      if (error) throw error;

      const crmIds = (pays ?? []).map((p) => p.crm_payment_id).filter(Boolean) as string[];
      const qboIds = (pays ?? []).map((p) => p.qbo_id);

      const [{ data: trips }, { data: decisions }] = await Promise.all([
        crmIds.length
          ? supabase
              .from("trip_payments")
              .select("id, trip_id, trips:trip_id(trip_name, clients:client_id(name))")
              .in("id", crmIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("qbo_payment_review_decisions")
          .select("qbo_payment_id, decision, target_qbo_invoice_id, notes, reviewed_at")
          .in("qbo_payment_id", qboIds),
      ]);

      const tripMap = new Map<string, any>();
      (trips ?? []).forEach((t: any) => tripMap.set(t.id, t));
      const decMap = new Map<string, any>();
      (decisions ?? []).forEach((d: any) => decMap.set(d.qbo_payment_id, d));

      return (pays ?? []).map((p: any): UnmatchedRow => {
        const tp = p.crm_payment_id ? tripMap.get(p.crm_payment_id) : null;
        const dec = decMap.get(p.qbo_id);
        return {
          qbo_payment_id: p.qbo_id,
          amount: Number(p.total_amt ?? 0),
          payment_date: p.txn_date,
          customer_name:
            p.raw_payload?.CustomerRef?.name ?? p.raw_payload?.CustomerName ?? "Unknown",
          qbo_customer_id: p.qbo_customer_id,
          crm_payment_id: p.crm_payment_id,
          trip_name: tp?.trips?.trip_name ?? null,
          client_name: tp?.trips?.clients?.name ?? null,
          payment_ref_num: p.payment_ref_num,
          synced_at: p.synced_at,
          decision: (dec?.decision as Decision) ?? "pending",
          target_qbo_invoice_id: dec?.target_qbo_invoice_id ?? null,
          notes: dec?.notes ?? null,
          reviewed_at: dec?.reviewed_at ?? null,
        };
      });
    },
  });

  const rows = data ?? [];

  const customers = useMemo(() => {
    const set = new Set(rows.map((r) => r.customer_name));
    return ["all", ...Array.from(set).sort()];
  }, [rows]);
  const [customer, setCustomer] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;
    return rows.filter((r) => {
      if (q && !`${r.customer_name} ${r.qbo_payment_id} ${r.trip_name ?? ""} ${r.client_name ?? ""}`.toLowerCase().includes(q)) return false;
      if (customer !== "all" && r.customer_name !== customer) return false;
      if (linkType === "orphan" && r.crm_payment_id) return false;
      if (linkType === "crm_linked" && !r.crm_payment_id) return false;
      if (decisionFilter !== "all" && r.decision !== decisionFilter) return false;
      if (min != null && r.amount < min) return false;
      if (max != null && r.amount > max) return false;
      if (fromDate && (r.payment_date ?? "") < fromDate) return false;
      if (toDate && (r.payment_date ?? "") > toDate) return false;
      return true;
    });
  }, [rows, search, customer, linkType, decisionFilter, minAmount, maxAmount, fromDate, toDate]);

  const totals = useMemo(() => {
    const sum = filtered.reduce((s, r) => s + r.amount, 0);
    return { count: filtered.length, sum };
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, linked: 0, refunded: 0, written_off: 0, skip: 0 };
    rows.forEach((r) => { c[r.decision]++; });
    return c;
  }, [rows]);

  const saveDecision = async (row: UnmatchedRow, patch: Partial<UnmatchedRow>) => {
    const next = { ...row, ...patch };
    const { error } = await supabase
      .from("qbo_payment_review_decisions")
      .upsert(
        {
          qbo_payment_id: row.qbo_payment_id,
          decision: next.decision,
          target_qbo_invoice_id: next.target_qbo_invoice_id,
          notes: next.notes,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: "qbo_payment_id" }
      );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["qbo-unmatched-review"] });
    if (detail?.qbo_payment_id === row.qbo_payment_id) setDetail(next);
  };

  const handleExport = () => {
    exportToCSV(
      filtered.map((r) => ({
        qbo_payment_id: r.qbo_payment_id,
        amount: r.amount,
        payment_date: r.payment_date ?? "",
        customer_name: r.customer_name,
        qbo_customer_id: r.qbo_customer_id ?? "",
        link_type: r.crm_payment_id ? "crm_linked" : "orphan",
        crm_payment_id: r.crm_payment_id ?? "",
        trip_name: r.trip_name ?? "",
        client_name: r.client_name ?? "",
        decision: r.decision,
        target_qbo_invoice_id: r.target_qbo_invoice_id ?? "",
        notes: r.notes ?? "",
      })),
      `qbo_unmatched_review_${format(new Date(), "yyyyMMdd_HHmm")}`
    );
  };

  if (adminLoading) return <DashboardLayout><Skeleton className="h-96" /></DashboardLayout>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Phase 4: QBO Unmatched Payments Review</h1>
            <p className="text-sm text-muted-foreground">
              Manually classify QBO payments without a linked invoice.
            </p>
          </div>
          <Button variant="outline" onClick={handleExport}>Export CSV</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Total" value={counts.all} />
          <StatCard label="Pending" value={counts.pending} />
          <StatCard label="Linked" value={counts.linked} />
          <StatCard label="Refunded" value={counts.refunded} />
          <StatCard label="Written off" value={counts.written_off} />
          <StatCard label="Skip" value={counts.skip} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={linkType} onValueChange={(v) => setLinkType(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
                <TabsTrigger value="orphan">
                  Orphans ({rows.filter((r) => !r.crm_payment_id).length})
                </TabsTrigger>
                <TabsTrigger value="crm_linked">
                  CRM-linked ({rows.filter((r) => r.crm_payment_id).length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <Label className="text-xs">Search</Label>
                <Input placeholder="QBO ID, name, trip…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Customer</Label>
                <Select value={customer} onValueChange={setCustomer}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c} value={c}>{c === "all" ? "All customers" : c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Decision</Label>
                <Select value={decisionFilter} onValueChange={(v) => setDecisionFilter(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All decisions</SelectItem>
                    {DECISIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Min amount</Label>
                <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Max amount</Label>
                <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="∞" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {totals.count} payments · ${totals.sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <Skeleton className="h-96" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>QBO ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Target Inv</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.qbo_payment_id}>
                        <TableCell className="font-mono text-xs">{r.qbo_payment_id}</TableCell>
                        <TableCell>{r.payment_date ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div>{r.customer_name}</div>
                          {r.client_name && r.client_name !== r.customer_name && (
                            <div className="text-xs text-muted-foreground">CRM: {r.client_name}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.crm_payment_id ? (
                            <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-400">CRM</Badge>
                          ) : (
                            <Badge variant="outline">Orphan</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={r.decision}
                            onValueChange={(v) => saveDecision(r, { decision: v as Decision })}
                          >
                            <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DECISIONS.map((d) => (
                                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 w-24"
                            placeholder="Inv #"
                            defaultValue={r.target_qbo_invoice_id ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value.trim() || null;
                              if (v !== (r.target_qbo_invoice_id ?? null)) {
                                saveDecision(r, { target_qbo_invoice_id: v });
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>Notes</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filtered.length && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No payments match.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>QBO Payment {detail.qbo_payment_id}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-muted-foreground text-xs">Amount</div>${detail.amount.toFixed(2)}</div>
                  <div><div className="text-muted-foreground text-xs">Date</div>{detail.payment_date ?? "—"}</div>
                  <div><div className="text-muted-foreground text-xs">Customer</div>{detail.customer_name}</div>
                  <div><div className="text-muted-foreground text-xs">QBO Customer ID</div>{detail.qbo_customer_id ?? "—"}</div>
                  {detail.crm_payment_id && (
                    <>
                      <div><div className="text-muted-foreground text-xs">Trip</div>{detail.trip_name ?? "—"}</div>
                      <div><div className="text-muted-foreground text-xs">Client</div>{detail.client_name ?? "—"}</div>
                    </>
                  )}
                  <div><div className="text-muted-foreground text-xs">Decision</div>{decisionBadge(detail.decision)}</div>
                  <div><div className="text-muted-foreground text-xs">Reviewed</div>{detail.reviewed_at ? format(new Date(detail.reviewed_at), "PPp") : "—"}</div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    rows={6}
                    defaultValue={detail.notes ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (detail.notes ?? null)) saveDecision(detail, { notes: v });
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}