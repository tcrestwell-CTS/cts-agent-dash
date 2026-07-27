import { usePortalDashboard } from "@/hooks/usePortalData";
import { differenceInDays, parseISO } from "date-fns";
import { CreditCard, FileCheck, Upload, AlertTriangle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PortalAction {
  id: string;
  type: "payment_due" | "approval_needed" | "doc_upload" | "overdue";
  title: string;
  subtitle: string;
  href: string;
  urgency: "critical" | "warning" | "info";
}

export function PortalActionStrip() {
  const { data } = usePortalDashboard();
  const navigate = useNavigate();

  if (!data) return null;

  const actions: PortalAction[] = [];
  const today = new Date();

  // Check upcoming payments
  for (const trip of data.trips || []) {
    for (const payment of trip.payments || []) {
      if (payment.status !== "pending" || !payment.due_date) continue;
      const due = parseISO(payment.due_date);
      const days = differenceInDays(due, today);
      if (days <= 30) {
        const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(payment.amount));
        actions.push({
          id: `pay-${payment.id}`,
          type: days < 0 ? "overdue" : "payment_due",
          urgency: days < 0 ? "critical" : days <= 7 ? "warning" : "info",
          title: days < 0
            ? `Payment of ${fmt} is overdue`
            : days === 0 ? `Payment of ${fmt} is due today`
            : `Payment of ${fmt} due in ${days} day${days !== 1 ? "s" : ""}`,
          subtitle: trip.trip_name || "Your trip",
          href: `/client/trips/${trip.id}?tab=payments`,
        });
      }
    }
    // Check itinerary approval needed
    if (trip.approval_status === "pending_client") {
      actions.push({
        id: `approve-${trip.id}`,
        type: "approval_needed",
        urgency: "warning",
        title: "Your itinerary is awaiting your approval",
        subtitle: trip.trip_name || "Review and approve your travel plans",
        href: `/client/trips/${trip.id}?tab=itinerary`,
      });
    }
  }

  // Check travel docs incomplete
  const hasIncompleteDoc = (data.trips || []).some((t: any) =>
    t.depart_date && differenceInDays(parseISO(t.depart_date), today) <= 60 &&
    t.checklist_progress < 100
  );
  if (hasIncompleteDoc) {
    actions.push({
      id: "docs",
      type: "doc_upload",
      urgency: "info",
      title: "Travel document checklist incomplete",
      subtitle: "Complete your pre-travel checklist before departure",
      href: "/client/trips",
    });
  }

  if (actions.length === 0) return null;

  const urgencyConfig = {
    critical: {
      bg: "bg-destructive/10 border-destructive/30 hover:bg-destructive/10/70",
      text: "text-destructive",
      icon: AlertTriangle,
    },
    warning: {
      bg: "bg-warning/10 border-warning/30 hover:bg-warning/10/70",
      text: "text-warning",
      icon: CreditCard,
    },
    info: {
      bg: "bg-info/10 border-blue-100 hover:bg-info/10/60",
      text: "text-info",
      icon: FileCheck,
    },
  };

  const typeIcon = {
    payment_due: CreditCard,
    overdue: AlertTriangle,
    approval_needed: FileCheck,
    doc_upload: Upload,
  };

  return (
    <div className="space-y-2 mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
        Action needed
      </p>
      {actions.slice(0, 4).map((action) => {
        const cfg = urgencyConfig[action.urgency];
        const Icon = typeIcon[action.type];
        return (
          <button
            key={action.id}
            onClick={() => navigate(action.href)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
              cfg.bg
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", cfg.text)} />
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-semibold leading-snug", cfg.text)}>
                {action.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {action.subtitle}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
