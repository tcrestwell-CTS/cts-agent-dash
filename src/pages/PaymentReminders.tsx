import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Bell, Plus, Send, Search, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/utils";
import { differenceInDays, format, formatDistanceToNow } from "date-fns";
import { usePaymentReminders, type PaymentReminderRow } from "@/hooks/usePaymentReminders";
import { SendReminderDialog } from "@/components/payment-reminders/SendReminderDialog";
import { AddReminderDialog } from "@/components/payment-reminders/AddReminderDialog";

type FilterKey = "all" | "overdue" | "week" | "month" | "sent" | "unsent";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "sent", label: "Sent" },
  { key: "unsent", label: "Unsent" },
];

function reminderTypeLabel(t: string | null | undefined) {
  switch (t) {
    case "deposit": return "Deposit";
    case "balance_due": return "Balance Due";
    case "final": case "final_balance": case "final_payment": return "Final Payment";
    case "installment": return "Installment";
    case "custom": return "Custom";
    default: return "Payment";
  }
}

function urgencyClass(daysUntil: number) {
  if (daysUntil < 0) return "bg-destructive/10 hover:bg-destructive/15";
  if (daysUntil <= 7) return "bg-amber-500/10 hover:bg-amber-500/15";
  if (daysUntil <= 30) return "bg-yellow-500/10 hover:bg-yellow-500/15";
  return "bg-emerald-500/10 hover:bg-emerald-500/15";
}

function urgencyBadge(daysUntil: number) {
  if (daysUntil < 0) return <Badge variant="destructive">Overdue {Math.abs(daysUntil)}d</Badge>;
  if (daysUntil === 0) return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Due today</Badge>;
  if (daysUntil <= 7) return <Badge className="bg-amber-500 text-white hover:bg-amber-600">{daysUntil}d</Badge>;
  if (daysUntil <= 30) return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">{daysUntil}d</Badge>;
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">{daysUntil}d</Badge>;
}

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export default function PaymentReminders() {
  const { data, isLoading } = usePaymentReminders();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [active, setActive] = useState<PaymentReminderRow | null>(null);

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const enriched = useMemo(() => {
    return (data || []).map((r) => {
      const due = r.due_date ? parseLocalDate(r.due_date) : null;
      const daysUntil = due ? differenceInDays(due, today) : Number.POSITIVE_INFINITY;
      return { ...r, _due: due, _daysUntil: daysUntil };
    });
  }, [data, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((r) => {
      if (q && !(r.trips?.clients?.name || "").toLowerCase().includes(q)) return false;
      switch (filter) {
        case "overdue": return r._daysUntil < 0;
        case "week": return r._daysUntil >= 0 && r._daysUntil <= 7;
        case "month": return r._daysUntil >= 0 && r._daysUntil <= 30;
        case "sent": return !!r.last_sent_at;
        case "unsent": return !r.last_sent_at;
        default: return true;
      }
    });
  }, [enriched, filter, search]);

  const counts = useMemo(() => {
    const overdue = enriched.filter((r) => r._daysUntil < 0).length;
    const week = enriched.filter((r) => r._daysUntil >= 0 && r._daysUntil <= 7).length;
    const total = enriched.length;
    const totalDue = enriched.reduce((s, r) => s + Number(r.amount || 0), 0);
    return { overdue, week, total, totalDue };
  }, [enriched]);

  const handleSend = (row: PaymentReminderRow) => {
    setActive(row);
    setSendOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-serif tracking-tight" style={{ color: "#0d1b2a" }}>
              Payment Reminders
            </h1>
            <p className="text-muted-foreground mt-1">
              Upcoming client payments. Send a branded reminder with one click.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} style={{ background: "#c9a84c", color: "#0d1b2a" }}>
            <Plus className="h-4 w-4 mr-2" /> Add Reminder
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Upcoming</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{counts.total}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold text-destructive">{counts.overdue}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Due This Week</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold text-amber-600">{counts.week}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Outstanding</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{fmtUSD(counts.totalDue)}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={filter === f.key ? "default" : "outline"}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search client name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                <Bell className="h-8 w-8 opacity-40" />
                No reminders match this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Trip</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount Due</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Until</TableHead>
                      <TableHead>Last Sent</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const client = r.trips?.clients;
                      const hasEmail = !!client?.email;
                      return (
                        <TableRow key={r.id} className={cn(urgencyClass(r._daysUntil))}>
                          <TableCell>
                            <div className="font-medium">{client?.name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{client?.email || "no email on file"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{r.trips?.trip_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.trips?.destination || ""}</div>
                          </TableCell>
                          <TableCell>{reminderTypeLabel(r.payment_type)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtUSD(Number(r.amount))}</TableCell>
                          <TableCell>{r._due ? format(r._due, "MMM d, yyyy") : "—"}</TableCell>
                          <TableCell>{Number.isFinite(r._daysUntil) ? urgencyBadge(r._daysUntil) : "—"}</TableCell>
                          <TableCell className="text-xs">
                            {r.last_sent_at ? (
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary">Sent</Badge>
                                <span className="text-muted-foreground">
                                  {formatDistanceToNow(new Date(r.last_sent_at), { addSuffix: true })}
                                </span>
                              </div>
                            ) : (
                              <Badge variant="outline">Not Sent</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!hasEmail ? (
                              <Badge variant="outline" className="gap-1">
                                <AlertCircle className="h-3 w-3" /> No email
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleSend(r)}
                                style={{ background: "#0d1b2a", color: "#ffffff" }}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                {r.last_sent_at ? "Resend" : "Send"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SendReminderDialog open={sendOpen} onOpenChange={setSendOpen} reminder={active} />
      <AddReminderDialog open={addOpen} onOpenChange={setAddOpen} />
    </DashboardLayout>
  );
}