import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays, parseISO, format, addDays } from "date-fns";
import { AlertTriangle, Clock, Users, ChevronRight, Plane, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/patterns/Panel";
import { Skeleton } from "@/components/ui/skeleton";

interface ActionItem {
  id: string;
  type: "payment_due" | "departing_soon" | "follow_up" | "unread_lead";
  urgency: "critical" | "warning" | "info";
  title: string;
  subtitle: string;
  href: string;
  daysUntil?: number;
  amount?: number;
}

export function TodayActionItems() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["action-items", user?.id],
    queryFn: async (): Promise<ActionItem[]> => {
      const now = new Date();
      const actions: ActionItem[] = [];

      // Payments due in next 14 days
      const { data: rawPayments } = await supabase
        .from("trip_payments")
        .select("id, amount, due_date, trip_id, trips!inner(trip_name, status, total_paid, total_gross_sales, client_id, user_id, clients!trips_client_id_fkey(name))")
        .eq("status", "pending")
        .eq("trips.user_id", user!.id)
        .not("due_date", "is", null)
        .lte("due_date", addDays(now, 14).toISOString().split("T")[0])
        .order("due_date", { ascending: true })
        .limit(100);

      // Skip cancelled/archived trips and trips already paid in full
      const payments = (rawPayments || []).filter((p: any) => {
        const t = p.trips;
        if (!t) return false;
        if (["cancelled", "archived", "completed"].includes(t.status)) return false;
        const total = Number(t.total_gross_sales || 0);
        if (total > 0 && Number(t.total_paid || 0) >= total - 0.01) return false;
        return true;
      }).slice(0, 5);

      for (const p of payments) {
        const due = parseISO((p as any).due_date);
        const days = differenceInDays(due, now);
        const tripName = (p as any).trips?.trip_name || "Trip";
        const clientName = (p as any).trips?.clients?.name || "";
        actions.push({
          id: p.id,
          type: "payment_due",
          urgency: days <= 3 ? "critical" : days <= 7 ? "warning" : "info",
          title: `${clientName || tripName} balance`,
          subtitle: `$${Number(p.amount).toLocaleString()} ${days <= 0 ? "due today" : days === 1 ? "due tomorrow" : `due in ${days} days`}`,
          href: `/trips/${(p as any).trip_id}?tab=payments`,
          daysUntil: days,
          amount: Number(p.amount),
        });
      }

      // Trips departing in next 14 days
      const { data: trips } = await supabase
        .from("trips")
        .select("id, trip_name, depart_date, client_id, clients!trips_client_id_fkey(name)")
        .in("status", ["confirmed", "booked"])
        .eq("user_id", user!.id)
        .not("depart_date", "is", null)
        .gte("depart_date", now.toISOString().split("T")[0])
        .lte("depart_date", addDays(now, 14).toISOString().split("T")[0])
        .order("depart_date", { ascending: true })
        .limit(5);

      for (const t of trips || []) {
        const dep = parseISO((t as any).depart_date);
        const days = differenceInDays(dep, now);
        actions.push({
          id: t.id,
          type: "departing_soon",
          urgency: days <= 3 ? "critical" : days <= 7 ? "warning" : "info",
          title: `${t.trip_name || "Trip"} departing`,
          subtitle: `${(t as any).clients?.name || "Client"} · ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}`,
          href: `/trips/${t.id}`,
          daysUntil: days,
        });
      }

      // Leads with no activity in 3+ days
      const staleDate = addDays(now, -3).toISOString();
      const { data: staleTrips } = await supabase
        .from("trips")
        .select("id, trip_name, updated_at, client_id, clients!trips_client_id_fkey(name)")
        .in("status", ["lead", "quoted"])
        .eq("user_id", user!.id)
        .lt("updated_at", staleDate)
        .order("updated_at", { ascending: true })
        .limit(4);

      for (const t of staleTrips || []) {
        const days = differenceInDays(now, parseISO((t as any).updated_at));
        actions.push({
          id: `stale-${t.id}`,
          type: "follow_up",
          urgency: days >= 7 ? "warning" : "info",
          title: `Follow up on ${t.trip_name || "Trip"}`,
          subtitle: `${(t as any).clients?.name || "Client"} · no reply for ${days} day${days !== 1 ? "s" : ""}`,
          href: `/trips/${t.id}`,
        });
      }

      return actions.sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a.urgency] - order[b.urgency];
      });
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  });

  if (isLoading) {
    return (
      <Panel className="p-[18px]">
        <div className="mb-4 h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </Panel>
    );
  }

  if (items.length === 0) {
    return (
      <Panel className="p-[18px]">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span className="text-[15px] font-semibold text-foreground">Needs your attention today</span>
        </div>
        <p className="mt-3 text-[13.5px] text-muted-foreground">
          You're all caught up — nothing urgent right now.
        </p>
      </Panel>
    );
  }

  const departuresCount = items.filter((i) => i.type === "departing_soon").length;
  const proposalsCount = items.filter((i) => i.type === "follow_up").length;

  const urgencyConfig = {
    critical: { dot: "bg-destructive", border: "border-destructive/20", text: "text-destructive" },
    warning:  { dot: "bg-warning", border: "border-warning/20", text: "text-warning" },
    info:     { dot: "bg-info", border: "border-info/20", text: "text-info" },
  };

  const typeIcon = {
    payment_due:    DollarSign,
    departing_soon: Plane,
    follow_up:      Clock,
    unread_lead:    Users,
  };

  const topThree = items.slice(0, 3);

  return (
    <Panel className="p-[18px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[15px] font-semibold text-foreground">Needs your attention today</span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          {departuresCount} departure{departuresCount !== 1 ? "s" : ""} ≤14d · {proposalsCount} proposal{proposalsCount !== 1 ? "s" : ""} awaiting reply
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topThree.map((item) => {
          const cfg = urgencyConfig[item.urgency];
          const TypeIcon = typeIcon[item.type];
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/30",
                cfg.border
              )}
            >
              <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", cfg.dot)} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold leading-tight text-foreground">{item.title}</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">{item.subtitle}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50" />
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
