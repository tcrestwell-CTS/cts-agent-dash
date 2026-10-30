import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, addDays } from "date-fns";
import {
  Download,
  TrendingUp,
  DollarSign,
  Receipt,
  AlertTriangle,
  Wallet,
  Users,
  FileSpreadsheet,
  BookOpen,
  Loader2,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelBody } from "@/components/patterns/Panel";
import { SemanticStatusPill } from "@/components/patterns/StatusPill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { exportToCSV, formatCurrencyForExport, formatDateForExport } from "@/lib/csvExport";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { fetchSupplierMap, fetchClientMap, fetchProfileMap } from "@/lib/bookkeeperLookups";
import { toast } from "sonner";
import { BookkeeperBreadcrumb } from "@/components/bookkeeper/shared";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end), label: `${MONTHS[month]} ${year}` };
}

function yearRange(year: number) {
  return { start: `${year}-01-01`, end: `${year + 1}-01-01`, label: String(year) };
}

type BucketKey = "current" | "1-30" | "31-60" | "61-90" | "90+";
const bucketFor = (d: number): BucketKey =>
  d <= 0 ? "current" : d <= 30 ? "1-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : "90+";

// ------------------------------- Queries -------------------------------

function useIncomeRows(year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return useQuery({
    queryKey: ["export-income", year, month],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) =>
        (supabase as any)
          .from("trip_payments")
          .select(
            "id, payment_date, amount, payment_type, payment_method, status, stripe_payment_intent_id, qbo_payment_id, qbo_sync_status, trip_id, booking_id, trips:trip_id(trip_name, client_id)"
          )
          .eq("status", "paid")
          .gte("payment_date", start)
          .lt("payment_date", end)
          .order("payment_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
      const clientMap = await fetchClientMap(data.map((r: any) => r.trips?.client_id));
      return data.map((r: any) => ({
        ...r,
        trips: r.trips ? { ...r.trips, clients: clientMap[r.trips.client_id] ?? null } : r.trips,
      }));
    },
  });
}

function useExpenseRows(year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return useQuery({
    queryKey: ["export-expenses", year, month],
    queryFn: async () => {
      const [suppliers, fees] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          (supabase as any)
            .from("bookings")
            .select(
              "id, supplier_paid_date, supplier_paid_amount, supplier_paid_method, supplier_paid_reference, confirmation_number, supplier_id, trip_id, trips:trip_id(trip_name)"
            )
            .eq("supplier_paid_status", "paid")
            .gte("supplier_paid_date", start)
            .lt("supplier_paid_date", end)
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchAllRows<any>((from, to) =>
          (supabase as any)
            .from("trip_payments")
            .select("id, payment_date, stripe_fee, stripe_payment_intent_id, trip_id")
            .eq("status", "paid")
            .gt("stripe_fee", 0)
            .gte("payment_date", start)
            .lt("payment_date", end)
            .order("id", { ascending: true })
            .range(from, to),
        ),
      ]);
      const supMap = await fetchSupplierMap(suppliers.map((r: any) => r.supplier_id));
      return {
        suppliers: suppliers.map((r: any) => ({
          ...r,
          suppliers: supMap[r.supplier_id] ?? null,
        })),
        fees,
      };
    },
  });
}

function useCommissionRows(year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return useQuery({
    queryKey: ["export-commissions", year, month],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) =>
        (supabase as any)
          .from("commissions")
          .select("id, user_id, booking_id, amount, rate, status, paid_date, created_at")
          .gte("created_at", start)
          .lt("created_at", end)
          .order("id", { ascending: true })
          .range(from, to),
      );
      const userIds = Array.from(new Set(data.map((r: any) => r.user_id).filter(Boolean)));
      const profMap = await fetchProfileMap(userIds as string[]);
      return data.map((r: any) => ({ ...r, profile: profMap[r.user_id] }));
    },
  });
}

function usePayoutRegister(year: number) {
  const { start, end } = yearRange(year);
  return useQuery({
    queryKey: ["export-1099", year],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) =>
        (supabase as any)
          .from("commissions")
          .select("user_id, amount, status, paid_date")
          .eq("status", "paid")
          .gte("paid_date", start)
          .lt("paid_date", end)
          .order("paid_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
      const totals = new Map<string, number>();
      data.forEach((r: any) => {
        totals.set(r.user_id, (totals.get(r.user_id) || 0) + Number(r.amount || 0));
      });
      const userIds = Array.from(totals.keys());
      const profMap = await fetchProfileMap(userIds);
      return Object.values(profMap).map((p) => ({
        agent_name: p.full_name ?? "",
        agent_email: "",
        total_earnings_ytd: totals.get(p.user_id) || 0,
      }));
    },
  });
}

function useARAging() {
  return useQuery({
    queryKey: ["export-ar-aging"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) =>
        (supabase as any)
          .from("invoices")
          .select(
            "id, invoice_number, invoice_date, trip_name, client_name, total_amount, amount_paid, amount_remaining, status"
          )
          .gt("amount_remaining", 0)
          .order("id", { ascending: true })
          .range(from, to),
      );
      const today = new Date();
      return data.map((i: any) => {
        const created = i.invoice_date ? new Date(i.invoice_date + "T00:00:00") : today;
        const days = Math.max(0, differenceInDays(today, created));
        return {
          client: i.client_name ?? "",
          trip: i.trip_name ?? "",
          invoice_number: i.invoice_number ?? "",
          total: Number(i.total_amount || 0),
          balance: Number(i.amount_remaining || 0),
          invoice_date: i.invoice_date ?? "",
          days_outstanding: days,
          bucket: bucketFor(days),
        };
      });
    },
  });
}

function useAPAging() {
  return useQuery({
    queryKey: ["export-ap-aging"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) =>
        (supabase as any)
          .from("bookings")
          .select(
            "id, confirmation_number, status, supplier_paid_status, supplier_payout, created_at, supplier_id, trips:trip_id(trip_name, return_date)"
          )
          .neq("supplier_paid_status", "paid")
          .in("status", ["confirmed", "completed"])
          .order("id", { ascending: true })
          .range(from, to),
      );
      const today = new Date();
      const supMap = await fetchSupplierMap((data ?? []).map((b: any) => b.supplier_id));
      return (data ?? [])
        .map((b: any) => ({ ...b, suppliers: supMap[b.supplier_id] ?? null }))
        .filter((b: any) => Number(b.supplier_payout || 0) > 0)
        .map((b: any) => {
          const ret = b.trips?.return_date ? new Date(b.trips.return_date + "T00:00:00") : null;
          const created = b.created_at ? new Date(b.created_at) : today;
          const est = ret ? addDays(ret, 30) : addDays(created, 45);
          const days = Math.max(0, differenceInDays(today, est));
          return {
            supplier: b.suppliers?.name ?? "",
            supplier_email: b.suppliers?.contact_email ?? "",
            trip: b.trips?.trip_name ?? "",
            confirmation_number: b.confirmation_number ?? "",
            booking_date: b.created_at ? formatDateForExport(b.created_at) : "",
            est_due_date: est.toISOString().slice(0, 10),
            amount_owed: Number(b.supplier_payout || 0),
            days_outstanding: days,
            bucket: bucketFor(days),
            supplier_paid_status: b.supplier_paid_status ?? "unpaid",
          };
        });
    },
  });
}

// ------------------------------- Page -------------------------------

export default function BookkeeperExport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const logAction = useLogBookkeeperAction();
  useEffect(() => {
    logAction("view", "bookkeeper_export");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const period = monthRange(year, month);

  const income = useIncomeRows(year, month);
  const expenses = useExpenseRows(year, month);
  const commissions = useCommissionRows(year, month);
  const arAging = useARAging();
  const apAging = useAPAging();
  const payouts = usePayoutRegister(year);

  // P&L summary
  const plSummary = useMemo(() => {
    const inc = (income.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const cogs = (expenses.data?.suppliers ?? []).reduce(
      (s: number, r: any) => s + Number(r.supplier_paid_amount || 0),
      0,
    );
    const fees = (expenses.data?.fees ?? []).reduce(
      (s: number, r: any) => s + Number(r.stripe_fee || 0),
      0,
    );
    return {
      income: inc,
      cogs,
      gross_profit: inc - cogs,
      expenses: fees,
      net_income: inc - cogs - fees,
    };
  }, [income.data, expenses.data]);

  const expenseRows = useMemo(() => {
    const sup = (expenses.data?.suppliers ?? []).map((r: any) => ({
      type: "supplier_payment",
      date: r.supplier_paid_date,
      supplier: r.suppliers?.name ?? "",
      trip: r.trips?.trip_name ?? "",
      confirmation_number: r.confirmation_number ?? "",
      amount: Number(r.supplier_paid_amount || 0),
      method: r.supplier_paid_method ?? "",
      reference: r.supplier_paid_reference ?? "",
    }));
    const fees = (expenses.data?.fees ?? []).map((r: any) => ({
      type: "stripe_fee",
      date: r.payment_date,
      supplier: "Stripe",
      trip: "",
      confirmation_number: r.stripe_payment_intent_id ?? "",
      amount: Number(r.stripe_fee || 0),
      method: "stripe",
      reference: r.stripe_payment_intent_id ?? "",
    }));
    return [...sup, ...fees].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [expenses.data]);

  const fullLedger = useMemo(() => {
    const inc = (income.data ?? []).map((r: any) => ({
      date: r.payment_date,
      type: "income",
      description: r.trips?.trip_name ?? r.payment_type ?? "",
      counterparty: r.trips?.clients?.name ?? "",
      amount: Number(r.amount || 0),
      reference: r.stripe_payment_intent_id ?? "",
    }));
    const exp = expenseRows.map((r) => ({
      date: r.date,
      type: "expense",
      description: r.trip || r.type,
      counterparty: r.supplier,
      amount: -Number(r.amount || 0),
      reference: r.reference ?? "",
    }));
    return [...inc, ...exp].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [income.data, expenseRows]);

  // ------------------------------- Handlers -------------------------------

  const dl = (name: string, rows: any[], action: string) => {
    if (!rows.length) {
      toast.info("No rows to export.");
      return;
    }
    exportToCSV(rows, name);
    logAction("export", action, { period: period.label, rows: rows.length });
    toast.success(`Exported ${rows.length} rows.`);
  };

  const handlers = {
    pl: () =>
      dl(`pl-summary-${year}-${String(month + 1).padStart(2, "0")}`, [
        { period: period.label, ...plSummary },
      ], "pl_summary"),
    income: () =>
      dl(
        `income-ledger-${year}-${String(month + 1).padStart(2, "0")}`,
        (income.data ?? []).map((r: any) => ({
          payment_date: r.payment_date,
          amount: formatCurrencyForExport(Number(r.amount || 0)),
          trip: r.trips?.trip_name ?? "",
          client: r.trips?.clients?.name ?? "",
          client_email: r.trips?.clients?.email ?? "",
          payment_type: r.payment_type ?? "",
          payment_method: r.payment_method ?? "",
          stripe_payment_intent_id: r.stripe_payment_intent_id ?? "",
          qbo_payment_id: r.qbo_payment_id ?? "",
          qbo_sync_status: r.qbo_sync_status ?? "",
        })),
        "income_ledger",
      ),
    expenses: () =>
      dl(
        `expense-ledger-${year}-${String(month + 1).padStart(2, "0")}`,
        expenseRows.map((r) => ({ ...r, amount: formatCurrencyForExport(r.amount) })),
        "expense_ledger",
      ),
    ar: () =>
      dl(
        `ar-aging-${formatDateForExport(new Date())}`,
        (arAging.data ?? []).map((r) => ({
          ...r,
          total: formatCurrencyForExport(r.total),
          balance: formatCurrencyForExport(r.balance),
        })),
        "ar_aging",
      ),
    ap: () =>
      dl(
        `ap-aging-${formatDateForExport(new Date())}`,
        (apAging.data ?? []).map((r) => ({
          ...r,
          amount_owed: formatCurrencyForExport(r.amount_owed),
        })),
        "ap_aging",
      ),
    commissions: () =>
      dl(
        `commissions-${year}-${String(month + 1).padStart(2, "0")}`,
        (commissions.data ?? []).map((r: any) => {
          const rate = Number(r.rate || 0);
          const gross = rate > 0 ? Number(r.amount || 0) / (rate / 100) : Number(r.amount || 0);
          return {
            agent_name: r.profile?.full_name ?? "",
            agent_email: r.profile?.email ?? "",
            tier: r.profile?.commission_tier ?? "",
            booking_id: r.booking_id,
            gross_commission: formatCurrencyForExport(gross),
            rate_pct: rate,
            agent_share: formatCurrencyForExport(Number(r.amount || 0)),
            status: r.status,
            paid_date: r.paid_date ?? "",
            created_at: r.created_at,
          };
        }),
        "commission_register",
      ),
    payouts: () =>
      dl(
        `agent-payouts-1099-${year}`,
        (payouts.data ?? []).map((r) => ({
          ...r,
          total_earnings_ytd: formatCurrencyForExport(r.total_earnings_ytd),
        })),
        "agent_payout_register",
      ),
    full: () =>
      dl(
        `full-ledger-${year}-${String(month + 1).padStart(2, "0")}`,
        fullLedger.map((r) => ({ ...r, amount: formatCurrencyForExport(r.amount) })),
        "full_ledger",
      ),
  };

  // ------------------------------- UI -------------------------------

  const years = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  type ExportCard = {
    icon: typeof Download;
    title: string;
    description: string;
    period: string;
    count: number;
    loading: boolean;
    onDownload: () => void;
  };

  const cards: ExportCard[] = [
    {
      icon: TrendingUp,
      title: "P&L Summary",
      description: "Income, COGS, gross profit, expenses, net income for the selected month.",
      period: period.label,
      count: income.isLoading || expenses.isLoading ? 0 : 1,
      loading: income.isLoading || expenses.isLoading,
      onDownload: handlers.pl,
    },
    {
      icon: DollarSign,
      title: "Income Ledger",
      description: "All paid trip payments with trip, client, Stripe PI, and QBO sync status.",
      period: period.label,
      count: income.data?.length ?? 0,
      loading: income.isLoading,
      onDownload: handlers.income,
    },
    {
      icon: Receipt,
      title: "Expense Ledger",
      description: "Supplier payments plus Stripe processing fees for the selected month.",
      period: period.label,
      count: expenseRows.length,
      loading: expenses.isLoading,
      onDownload: handlers.expenses,
    },
    {
      icon: AlertTriangle,
      title: "AR Aging",
      description: "Full accounts receivable aging snapshot as of today.",
      period: "As of today",
      count: arAging.data?.length ?? 0,
      loading: arAging.isLoading,
      onDownload: handlers.ar,
    },
    {
      icon: AlertTriangle,
      title: "AP Aging",
      description: "Full accounts payable aging snapshot as of today.",
      period: "As of today",
      count: apAging.data?.length ?? 0,
      loading: apAging.isLoading,
      onDownload: handlers.ap,
    },
    {
      icon: Wallet,
      title: "Commission Register",
      description: "All commissions in the period with agent, tier, gross, agent share, status.",
      period: period.label,
      count: commissions.data?.length ?? 0,
      loading: commissions.isLoading,
      onDownload: handlers.commissions,
    },
    {
      icon: Users,
      title: "Agent Payout Register (1099)",
      description: "Per-agent YTD totals for the selected year — formatted for 1099 prep.",
      period: String(year),
      count: payouts.data?.length ?? 0,
      loading: payouts.isLoading,
      onDownload: handlers.payouts,
    },
    {
      icon: BookOpen,
      title: "Full Transaction Ledger",
      description: "All income and expenses for the period, combined and sorted by date.",
      period: period.label,
      count: fullLedger.length,
      loading: income.isLoading || expenses.isLoading,
      onDownload: handlers.full,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-[18px] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <BookkeeperBreadcrumb page="Export Center" />
            <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.025em] text-foreground">
              <FileSpreadsheet className="h-[18px] w-[18px] text-accent" />
              Export Center
            </h1>
            <p className="text-[13.5px] text-muted-foreground">
              One-click CSV exports for the accountant. Period applies to monthly reports; aging snapshots are always
              as-of-today.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] font-medium text-muted-foreground">Month</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] font-medium text-muted-foreground">Year</label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Panel key={c.title} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 border-b border-border px-[17px] py-[14px]">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-accent/10">
                      <Icon className="h-4 w-4 text-accent" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[14.5px] font-semibold text-foreground">{c.title}</h3>
                      <p className="mt-1 text-[12.5px] text-muted-foreground">{c.description}</p>
                    </div>
                  </div>
                  <SemanticStatusPill status="muted" label={c.period} className="shrink-0" />
                </div>
                <PanelBody className="mt-auto flex items-center justify-between gap-2">
                  <div className="text-[13.5px]">
                    {c.loading ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Counting…
                      </span>
                    ) : (
                      <span>
                        <span className="font-semibold tabular-nums text-foreground">{c.count.toLocaleString()}</span>{" "}
                        <span className="text-muted-foreground">row{c.count === 1 ? "" : "s"}</span>
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={c.onDownload}
                    disabled={c.loading || c.count === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </Button>
                </PanelBody>
              </Panel>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
