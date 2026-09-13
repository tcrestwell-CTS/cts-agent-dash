import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ChevronRight } from "lucide-react";
import { format, isPast, differenceInDays } from "date-fns";
import { cn, parseLocalDate } from "@/lib/utils";


type PaymentRow = {
  id: string;
  amount: number;
  due_date: string;
  payment_type: string | null;
  details: string | null;
  trip_id: string;
  trips: {
    trip_name: string | null;
    destination: string | null;
    client_id: string | null;
    clients: { name: string | null } | null;
  } | null;
};

export default function PaymentsDue() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["payments-due-page", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_payments")
        .select(
          "id, amount, due_date, payment_type, details, trip_id, trips(trip_name, destination, client_id, clients!trips_client_id_fkey(name))"
        )
        .eq("status", "pending")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as PaymentRow[];
    },
    enabled: !!user,
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

  const overdue = (data || []).filter((p) => isPast(parseISO(p.due_date)));
  const upcoming = (data || []).filter((p) => !isPast(parseISO(p.due_date)));

  const totalDue = (data || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
            Crestwell Travel Services
          </p>
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Payments Due</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            All unpaid client payments with a due date
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard label="Overdue" value={overdue.length} urgent />
          <SummaryCard label="Upcoming" value={upcoming.length} />
          <SummaryCard label="Total Outstanding" value={formatCurrency(totalDue)} />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (data || []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No unpaid payments due.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(data || []).map((p) => {
              const due = parseISO(p.due_date);
              const daysOut = differenceInDays(due, new Date());
              const isOverdue = isPast(due);
              return (
                <Card
                  key={p.id}
                  onClick={() => navigate(`/trips/${p.trip_id}`)}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                        isOverdue ? "bg-destructive/10" : "bg-primary/10"
                      )}
                    >
                      <CreditCard
                        className={cn(
                          "h-5 w-5",
                          isOverdue ? "text-destructive" : "text-primary"
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground truncate">
                          {p.trips?.clients?.name || "Unknown client"}
                        </p>
                        <span className="text-muted-foreground text-sm truncate">
                          {p.trips?.trip_name || p.trips?.destination || "Trip"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {p.details || p.payment_type || "Payment"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-foreground">
                        {formatCurrency(Number(p.amount))}
                      </p>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <Badge variant={isOverdue ? "destructive" : "secondary"}>
                          {isOverdue
                            ? `${Math.abs(daysOut)}d overdue`
                            : daysOut === 0
                            ? "Due today"
                            : `Due in ${daysOut}d`}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(due, "MMM d")}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({
  label,
  value,
  urgent,
}: {
  label: string;
  value: string | number;
  urgent?: boolean;
}) {
  return (
    <Card className={cn(urgent && "border-destructive/30 bg-destructive/5")}>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold mt-1",
            urgent ? "text-destructive" : "text-foreground"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
