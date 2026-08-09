import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, CheckCircle2, Clock, ChevronRight, FileText } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  due_date: string | null;
  payment_date: string;
  payment_type: string;
  trip_id: string;
  stripe_receipt_url: string | null;
  trips: {
    trip_name: string | null;
    destination: string | null;
    client_id: string | null;
    clients: { name: string | null } | null;
  } | null;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

function formatPaymentType(type: string) {
  return type === "final_balance" ? "Final Balance" : type.charAt(0).toUpperCase() + type.slice(1);
}

export default function MyPayments() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // No agent-specific filter here on purpose — same as the admin
  // PaymentsDue page, this relies entirely on RLS to scope trips/
  // trip_payments to the logged-in agent's own book of business,
  // matching the pattern used everywhere else in this app.
  const { data, isLoading } = useQuery({
    queryKey: ["my-payments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_payments")
        .select(
          "id, amount, status, due_date, payment_date, payment_type, trip_id, stripe_receipt_url, trips(trip_name, destination, client_id, clients!trips_client_id_fkey(name))"
        )
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("payment_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as PaymentRow[];
    },
    enabled: !!user,
  });

  const payments = data || [];
  const paid = payments.filter((p) => p.status === "paid");
  const pending = payments.filter((p) => p.status === "pending");
  const totalPaid = paid.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalOutstanding = pending.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const overduePending = pending.filter((p) => p.due_date && isPast(parseISO(p.due_date)));

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">My Client Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Payments across all of your own clients' trips.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="text-2xl font-semibold mt-1 text-emerald-600">{formatCurrency(totalPaid)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-2xl font-semibold mt-1 text-amber-600">{formatCurrency(totalOutstanding)}</p>
                  {overduePending.length > 0 && (
                    <p className="text-xs text-destructive mt-1">{overduePending.length} overdue</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Total Transactions</p>
                  <p className="text-2xl font-semibold mt-1">{payments.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Due / pending */}
            {pending.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Due ({pending.length})
                </h2>
                <Card>
                  <CardContent className="p-0 divide-y">
                    {pending.map((p) => {
                      const overdue = p.due_date && isPast(parseISO(p.due_date));
                      return (
                        <button
                          key={p.id}
                          onClick={() => navigate(`/trips/${p.trip_id}`)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center",
                              overdue ? "bg-destructive/10" : "bg-amber-500/10")}>
                              <Clock className={cn("w-4 h-4", overdue ? "text-destructive" : "text-amber-600")} />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {p.trips?.clients?.name ?? "Unknown client"} — {formatPaymentType(p.payment_type)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {p.trips?.trip_name ?? "Untitled trip"}
                                {p.due_date && ` · Due ${format(parseISO(p.due_date), "MMM d, yyyy")}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-sm">{formatCurrency(p.amount)}</span>
                            {overdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Paid history */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Paid ({paid.length})
              </h2>
              {paid.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <Card>
                  <CardContent className="p-0 divide-y">
                    {paid.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {p.trips?.clients?.name ?? "Unknown client"} — {formatPaymentType(p.payment_type)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.trips?.trip_name ?? "Untitled trip"} · Paid {format(parseISO(p.payment_date), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm">{formatCurrency(p.amount)}</span>
                          {p.stripe_receipt_url && (
                            <a
                              href={p.stripe_receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <FileText className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {payments.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No payments on your trips yet.</p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
