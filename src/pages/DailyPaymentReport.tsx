import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { formatLocalDate, parseLocalDate, formatCurrency } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface ReportItem {
  amount: number;
  type: string;
  trip: string;
  destination: string | null;
  receiptUrl: string | null;
}
interface ClientGroup {
  clientName: string;
  clientEmail: string | null;
  total: number;
  count: number;
  items: ReportItem[];
}
interface Report {
  date: string;
  grandTotal: number;
  paymentCount: number;
  clientCount: number;
  clients: ClientGroup[];
}

const yesterday = () =>
  new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function currentMonth() {
  return format(new Date(), "yyyy-MM");
}

interface MonthDayRow {
  date: string;
  total: number;
  count: number;
}
interface MonthReport {
  month: string;
  grandTotal: number;
  paymentCount: number;
  totalFees: number;
  netTotal: number;
  days: MonthDayRow[];
}

export default function DailyPaymentReport() {
  const [date, setDate] = useState<string>(yesterday());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [tab, setTab] = useState<"day" | "month">("day");
  const [month, setMonth] = useState<string>(currentMonth());
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthReport, setMonthReport] = useState<MonthReport | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientEmail, setClientEmail] = useState<string>("");

  useEffect(() => {
    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("id, name, email")
          .order("name", { ascending: true });
        if (error) throw error;
        setClients(data || []);
      } catch (e) {
        console.error("Failed to load clients", e);
      } finally {
        setClientsLoading(false);
      }
    };
    fetchClients();
  }, []);

  const load = async (d: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "daily-payment-report",
        { body: { date: d, sendEmail: false, clientEmail: clientEmail || undefined } },
      );
      if (error) throw error;
      setReport(data as Report);
    } catch (e: any) {
      toast.error(e.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(date); /* eslint-disable-next-line */ }, []);

  const loadMonth = async (m: string) => {
    setMonthLoading(true);
    try {
      const first = parseLocalDate(`${m}-01`);
      const start = startOfMonth(first);
      const end = endOfMonth(first);
      const startStr = formatLocalDate(start);
      const endStr = formatLocalDate(end);

      const { data, error } = await supabase
        .from("trip_payments")
        .select("amount, stripe_fee, payment_date, status")
        .eq("status", "paid")
        .not("stripe_payment_intent_id", "is", null)
        .gte("payment_date", startStr)
        .lte("payment_date", endStr);
      if (error) throw error;

      const dayMap = new Map<string, MonthDayRow>();
      for (const d of eachDayOfInterval({ start, end })) {
        const k = formatLocalDate(d);
        dayMap.set(k, { date: k, total: 0, count: 0 });
      }
      let grandTotal = 0;
      let totalFees = 0;
      let paymentCount = 0;
      for (const row of data ?? []) {
        const key = (row.payment_date as string) ?? "";
        const bucket = dayMap.get(key);
        const gross = Number(row.amount) || 0;
        const fee = Number(row.stripe_fee) || 0;
        // amount stored is net; report gross by adding fee back for consistency w/ daily view
        const grossReported = gross + fee;
        if (bucket) {
          bucket.total += grossReported;
          bucket.count += 1;
        }
        grandTotal += grossReported;
        totalFees += fee;
        paymentCount += 1;
      }
      setMonthReport({
        month: m,
        grandTotal,
        paymentCount,
        totalFees,
        netTotal: grandTotal - totalFees,
        days: Array.from(dayMap.values()),
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to load monthly report");
    } finally {
      setMonthLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "month" && !monthReport) loadMonth(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const sendEmail = async () => {
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("daily-payment-report", {
        body: { date, sendEmail: true },
      });
      if (error) throw error;
      toast.success("Report emailed");
    } catch (e: any) {
      toast.error(e.message || "Failed to email report");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
              Crestwell Travel Services
            </p>
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Payment Reports</h1>
            <p className="text-sm text-muted-foreground">
              Stripe payments received, viewable by day or month.
            </p>
          </div>
          {tab === "day" && (
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-44"
              />
            </div>
            <Button variant="outline" onClick={() => load(date)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button onClick={sendEmail} disabled={sending || !report}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              <span className="ml-2">Email this report</span>
            </Button>
          </div>
          )}
          {tab === "month" && (
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Month</label>
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-44"
                />
              </div>
              <Button variant="outline" onClick={() => loadMonth(month)} disabled={monthLoading}>
                {monthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="ml-2">Refresh</span>
              </Button>
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "day" | "month")}>
          <TabsList>
            <TabsTrigger value="day">By Day</TabsTrigger>
            <TabsTrigger value="month">By Month</TabsTrigger>
          </TabsList>

          <TabsContent value="day" className="mt-4 space-y-6">
        {report && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Collected</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold text-success">{money(report.grandTotal)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Payments</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{report.paymentCount}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Clients</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{report.clientCount}</div></CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Payments by client</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : !report || report.clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No Stripe payments received on {date}.
              </div>
            ) : (
              <div className="divide-y">
                {report.clients.map((c, idx) => (
                  <div key={idx} className="py-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{c.clientName}</div>
                        <Badge variant="secondary">{c.count} payment{c.count === 1 ? "" : "s"}</Badge>
                      </div>
                      {c.clientEmail && (
                        <div className="text-xs text-muted-foreground">{c.clientEmail}</div>
                      )}
                      <ul className="mt-2 space-y-1 text-sm">
                        {c.items.map((i, j) => (
                          <li key={j} className="text-muted-foreground">
                            <span className="font-medium text-foreground">{money(i.amount)}</span>
                            {" · "}{i.type}{" · "}
                            {i.trip}{i.destination ? ` — ${i.destination}` : ""}
                            {i.receiptUrl && (
                              <> · <a href={i.receiptUrl} target="_blank" rel="noreferrer" className="text-primary underline">receipt</a></>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-lg font-bold text-success whitespace-nowrap">
                      {money(c.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="month" className="mt-4 space-y-6">
            {monthReport && (
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gross Collected</CardTitle></CardHeader>
                  <CardContent><div className="text-3xl font-bold text-success">{formatCurrency(monthReport.grandTotal)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Stripe Fees</CardTitle></CardHeader>
                  <CardContent><div className="text-3xl font-bold text-destructive">{formatCurrency(monthReport.totalFees)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net</CardTitle></CardHeader>
                  <CardContent><div className="text-3xl font-bold">{formatCurrency(monthReport.netTotal)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Payments</CardTitle></CardHeader>
                  <CardContent><div className="text-3xl font-bold">{monthReport.paymentCount}</div></CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>
                  Daily totals — {monthReport ? format(parseLocalDate(`${monthReport.month}-01`), "MMMM yyyy") : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : !monthReport || monthReport.paymentCount === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No Stripe payments recorded in this month.
                  </div>
                ) : (
                  <>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthReport.days} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(d) => format(parseISO(d), "d")}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                            tickLine={false}
                            axisLine={false}
                            width={50}
                          />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(l) => format(parseISO(l as string), "PPP")}
                            contentStyle={{
                              background: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 6,
                            }}
                          />
                          <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-6 divide-y">
                      {monthReport.days
                        .filter((d) => d.count > 0)
                        .map((d) => (
                          <button
                            key={d.date}
                            onClick={() => {
                              setDate(d.date);
                              setTab("day");
                              load(d.date);
                            }}
                            className="w-full py-3 flex items-center justify-between text-left hover:bg-muted/50 px-2 rounded transition-colors"
                          >
                            <div>
                              <div className="font-medium text-sm">{format(parseISO(d.date), "EEE, MMM d")}</div>
                              <div className="text-xs text-muted-foreground">{d.count} payment{d.count === 1 ? "" : "s"}</div>
                            </div>
                            <div className="text-base font-semibold text-success">{formatCurrency(d.total)}</div>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}