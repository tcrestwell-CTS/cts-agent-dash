import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, CheckCircle2, Clock, XCircle, RotateCcw, Radio } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type LiveStatus = "succeeded" | "pending" | "failed" | "refunded" | "processing";

interface LivePaymentEvent {
  id: string;
  source: "checkout" | "trip";
  who: string;
  what: string;
  amount: number;
  status: LiveStatus;
  method: string | null;
  tripId: string | null;
  at: Date;
}

const normalizeStatus = (raw: string | null | undefined): LiveStatus => {
  const s = (raw || "").toLowerCase();
  if (s === "succeeded" || s === "paid" || s === "completed") return "succeeded";
  if (s === "failed" || s === "canceled" || s === "cancelled") return "failed";
  if (s === "refunded" || s === "disputed") return "refunded";
  if (s === "processing") return "processing";
  return "pending";
};

const statusMeta: Record<LiveStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  succeeded: {
    label: "Paid",
    className: "border-success/30 text-success bg-success/10",
    Icon: CheckCircle2,
  },
  processing: {
    label: "Processing",
    className: "border-primary/30 text-primary bg-primary/10",
    Icon: Clock,
  },
  pending: {
    label: "Pending",
    className: "border-warning/30 text-warning bg-warning/10",
    Icon: Clock,
  },
  failed: {
    label: "Failed",
    className: "border-destructive/40 text-destructive bg-destructive/10",
    Icon: XCircle,
  },
  refunded: {
    label: "Refunded",
    className: "border-muted-foreground/30 text-muted-foreground bg-muted",
    Icon: RotateCcw,
  },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

const safeDate = (value: string | null | undefined): Date => {
  if (!value) return new Date();
  try {
    const d = parseISO(value);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
};

export function LivePaymentActivity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  const { data: checkouts, isLoading: checkoutsLoading } = useQuery({
    queryKey: ["live-payments-checkout", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkout_payments")
        .select(
          "id, customer_name, customer_email, trip_name, booking_ref, amount_cents, status, payment_method, payment_type, trip_id, updated_at, created_at"
        )
        .order("updated_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: tripPays, isLoading: tripPaysLoading } = useQuery({
    queryKey: ["live-payments-trip", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_payments")
        .select(
          "id, amount, status, payment_type, payment_method, trip_id, updated_at, created_at, trips(trip_name, clients(name))"
        )
        .order("updated_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const isLoading = checkoutsLoading || tripPaysLoading;

  const events: LivePaymentEvent[] = useMemo(() => {
    const fromCheckout: LivePaymentEvent[] = (checkouts || []).map((row: any) => ({
      id: `checkout-${row.id}`,
      source: "checkout" as const,
      who: row.customer_name || row.customer_email || "Guest",
      what: row.trip_name || row.booking_ref || "Checkout payment",
      amount: Number(row.amount_cents || 0) / 100,
      status: normalizeStatus(row.status),
      method: row.payment_method || null,
      tripId: row.trip_id || null,
      at: safeDate(row.updated_at || row.created_at),
    }));

    const fromTrip: LivePaymentEvent[] = (tripPays || []).map((row: any) => ({
      id: `trip-${row.id}`,
      source: "trip" as const,
      who: row.trips?.clients?.name || "Client",
      what: row.trips?.trip_name || "Trip payment",
      amount: Number(row.amount || 0),
      status: normalizeStatus(row.status),
      method: row.payment_method || null,
      tripId: row.trip_id || null,
      at: safeDate(row.updated_at || row.created_at),
    }));

    return [...fromCheckout, ...fromTrip]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 8);
  }, [checkouts, tripPays]);

  // Realtime: Stripe webhooks write payment rows, which stream in here.
  useEffect(() => {
    if (!user) return;

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["live-payments-checkout"] });
      queryClient.invalidateQueries({ queryKey: ["live-payments-trip"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-payments"] });
      setLastEventAt(new Date());
    };

    const channel = supabase
      .channel("dashboard-live-payments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkout_payments" },
        (payload: any) => {
          const next = payload.new || {};
          const prev = payload.old || {};
          const status = normalizeStatus(next.status);
          if (status !== normalizeStatus(prev.status)) {
            const amount = Number(next.amount_cents || 0) / 100;
            const who = next.customer_name || next.customer_email || "A client";
            if (status === "succeeded") {
              toast.success(`Payment received: ${formatCurrency(amount)}`, {
                description: `${who} — ${next.trip_name || next.booking_ref || "checkout"}`,
              });
            } else if (status === "failed") {
              toast.error(`Payment failed: ${formatCurrency(amount)}`, { description: who });
            }
          }
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_payments" },
        () => refresh()
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Live Payment Status
          </CardTitle>
          <Badge
            variant="outline"
            className={
              live
                ? "text-xs border-success/30 text-success bg-success/10 gap-1"
                : "text-xs text-muted-foreground gap-1"
            }
          >
            <Radio className={`h-3 w-3 ${live ? "animate-pulse" : ""}`} />
            {live ? "Live" : "Connecting"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Updates automatically as Stripe confirms payments
          {lastEventAt ? ` • last update ${formatDistanceToNow(lastEventAt, { addSuffix: true })}` : ""}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No payment activity yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const meta = statusMeta[event.status];
              return (
                <div
                  key={event.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border bg-card transition-colors ${
                    event.tripId ? "hover:bg-muted/50 cursor-pointer" : ""
                  }`}
                  onClick={() => {
                    if (event.tripId) navigate(`/trips/${event.tripId}`);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <meta.Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <p className="font-medium text-sm truncate">{event.what}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.who}
                      {event.method ? ` • ${event.method}` : ""} •{" "}
                      {formatDistanceToNow(event.at, { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right ml-1 flex-shrink-0">
                    <p className="font-semibold text-sm">{formatCurrency(event.amount)}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${meta.className}`}>
                      {meta.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
