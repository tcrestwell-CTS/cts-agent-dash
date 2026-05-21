import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays, parseISO, format, addDays } from "date-fns";
import { AlertTriangle, Clock, Users, ChevronRight, Plane, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

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
      const { data: payments } = await supabase
        .from("trip_payments")
        .select("id, amount, due_date, trip_id, trips(trip_name, client_id, clients!trips_client_id_fkey(name))")
        .eq("status", "pending")
        .not("due_date", "is", null)
        .lte("due_date", addDays(now, 14).toISOString().split("T")[0])
        .order("due_date", { ascending: true })
        .limit(5);

      for (const p of payments || []) {
        const due = parseISO((p as any).due_date);
        const days = differenceInDays(due, now);
        const tripName = (p as any).trips?.trip_name || "Trip";
        const clientName = (p as any).trips?.clients?.name || "";
        actions.push({
          id: p.id,
          type: "payment_due",
          urgency: days <= 3 ? "critical" : days <= 7 ? "warning" : "info",
          title: `$${Number(p.amount).toLocaleString()} due ${days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days}d`}`,
          subtitle: `${tripName}${clientName ? ` · ${clientName}` : ""}`,
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
          title: `Departing ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}`,
          subtitle: `${t.trip_name || "Trip"}${(t as any).clients?.name ? ` · ${(t as any).clients.name}` : ""}`,
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
        .lt("updated_at", staleDate)
        .order("updated_at", { ascending: true })
        .limit(4);

      for (const t of staleTrips || []) {
        const days = differenceInDays(now, parseISO((t as any).updated_at));
        actions.push({
          id: `stale-${t.id}`,
          type: "follow_up",
          urgency: days >= 7 ? "warning" : "info",
          title: `No activity for ${days} day${days !== 1 ? "s" : ""}`,
          subtitle: `${t.trip_name || "Trip"}${(t as any).clients?.name ? ` · ${(t as any).clients.name}` : ""}`,
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
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
        <div className="h-4 w-32 bg-muted animate-pulse rounded mb-4" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-sm font-semibold tracking-tight text-foreground">Today's Actions</span>
        </div>
        <p className="text-sm text-muted-foreground mt-3 pl-3.5">
          You're all caught up — nothing urgent right now.
        </p>
      </div>
    );
  }

  const urgencyConfig = {
    critical: { dot: "bg-red-500", bg: "bg-red-50 border-red-100 hover:bg-red-100/70", text: "text-red-700", icon: AlertTriangle },
    warning:  { dot: "bg-amber-500", bg: "bg-amber-50 border-amber-100 hover:bg-amber-100/70", text: "text-amber-700", icon: Clock },
    info:     { dot: "bg-blue-400", bg: "bg-blue-50/60 border-blue-100 hover:bg-blue-100/60", text: "text-blue-600", icon: Users },
  };

  const typeIcon = {
    payment_due:    DollarSign,
    departing_soon: Plane,
    follow_up:      Clock,
    unread_lead:    Users,
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-semibold tracking-tight text-foreground">Today's Actions</span>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-1.5">
        {items.map((item) => {
          const cfg = urgencyConfig[item.urgency];
          const TypeIcon = typeIcon[item.type];
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.href)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                cfg.bg
              )}
            >
              <TypeIcon className={cn("h-3.5 w-3.5 shrink-0", cfg.text)} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-semibold leading-tight", cfg.text)}>{item.title}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
