import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export default function DailyPaymentReport() {
  const [date, setDate] = useState<string>(yesterday());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const load = async (d: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "daily-payment-report",
        { body: { date: d, sendEmail: false } },
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
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Daily Payment Report</h1>
            <p className="text-sm text-muted-foreground">
              Stripe payments received on the selected date, grouped by client.
            </p>
          </div>
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
        </div>

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
      </div>
    </DashboardLayout>
  );
}