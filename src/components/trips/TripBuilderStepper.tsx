import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, X, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePublishReadiness } from "@/components/trips/PublishTripButton";
import { cn } from "@/lib/utils";

const KEY = (id: string) => `tripBuilderGuided:${id}`;

export function enableGuidedBuilder(tripId: string) {
  try { sessionStorage.setItem(KEY(tripId), "1"); } catch { /* ignore */ }
}
export function isGuidedBuilder(tripId?: string) {
  if (!tripId) return false;
  try { return sessionStorage.getItem(KEY(tripId)) === "1"; } catch { return false; }
}
export function disableGuidedBuilder(tripId: string) {
  try { sessionStorage.removeItem(KEY(tripId)); } catch { /* ignore */ }
}

export const PAYMENT_SETTINGS_ANCHOR = "trip-payment-settings";
export const PUBLISH_ANCHOR = "trip-publish-button";

type StepKey = "basics" | "itinerary" | "pricing" | "payments" | "publish";

interface Props {
  trip: any;
  onEditBasics: () => void;
  onExit: () => void;
}

export function TripBuilderStepper({ trip, onEditBasics, onExit }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const tripId: string = trip.id;
  const { data: checks = [], refetch } = usePublishReadiness(tripId);
  const { data: scheduledCount = 0, refetch: refetchPayments } = useQuery({
    queryKey: ["trip-builder-payments", tripId],
    queryFn: async () => {
      const { count } = await supabase
        .from("trip_payments")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId)
        .neq("status", "cancelled");
      return count || 0;
    },
  });

  useEffect(() => { refetch(); refetchPayments(); }, [location.pathname, location.search, location.hash, trip.updated_at]);

  const passed = (k: string) => checks.find((c) => c.key === k)?.passed ?? false;
  const requiredOk = checks.length > 0 && checks.filter((c) => c.required).every((c) => c.passed);

  const current: StepKey = location.pathname.endsWith("/itinerary")
    ? "itinerary"
    : /tab=(bookings|payments)/.test(location.search)
      ? "pricing"
      : location.hash === `#${PUBLISH_ANCHOR}`
        ? "publish"
        : location.hash === `#${PAYMENT_SETTINGS_ANCHOR}`
          ? "payments"
          : "basics";

  const steps: { key: StepKey; label: string; done: boolean; hint: string }[] = [
    { key: "basics", label: "Basics", done: !!trip.trip_name && !!trip.depart_date && passed("client"), hint: "Name, dates, destination and client" },
    { key: "itinerary", label: "Itinerary", done: passed("itinerary"), hint: "Add days and items" },
    { key: "pricing", label: "Pricing & packages", done: passed("pricing"), hint: "Add bookings or priced items" },
    { key: "payments", label: "Payment plan", done: scheduledCount > 0, hint: "Choose deposit / schedule and create payments" },
    { key: "publish", label: "Review & publish", done: !!trip.published_at && requiredOk, hint: "Resolve required items, then publish" },
  ];

  const scrollTo = (id: string) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);

  const go = (k: StepKey) => {
    if (k === "basics") { navigate(`/trips/${tripId}`); onEditBasics(); }
    else if (k === "itinerary") navigate(`/trips/${tripId}/itinerary`);
    else if (k === "pricing") navigate(`/trips/${tripId}?tab=bookings`);
    else if (k === "payments") { navigate(`/trips/${tripId}#${PAYMENT_SETTINGS_ANCHOR}`); scrollTo(PAYMENT_SETTINGS_ANCHOR); }
    else { navigate(`/trips/${tripId}#${PUBLISH_ANCHOR}`); scrollTo(PUBLISH_ANCHOR); }
  };

  const idx = steps.findIndex((s) => s.key === current);
  const active = steps[idx];

  return (
    <div className="rounded-[9px] border border-border bg-card p-3 space-y-3" aria-label="Guided trip builder">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Guided builder · Step {idx + 1} of {steps.length}
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onExit}>
          <X className="h-3.5 w-3.5 mr-1" /> Exit guided mode
        </Button>
      </div>
      <ol className="grid grid-cols-5 gap-2">
        {steps.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => go(s.key)}
              aria-current={s.key === current ? "step" : undefined}
              className={cn(
                "w-full text-left rounded-md border px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                s.key === current ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              )}
            >
              <div className="flex items-center gap-1.5">
                {s.done
                  ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  : <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
                <span className="text-xs font-semibold truncate">{i + 1}. {s.label}</span>
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate hidden md:block">{s.hint}</p>
            </button>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={idx <= 0} onClick={() => go(steps[idx - 1].key)}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
        </Button>
        <span className="text-xs text-muted-foreground">{active?.done ? "Step complete" : active?.hint}</span>
        <Button size="sm" disabled={idx >= steps.length - 1} onClick={() => go(steps[idx + 1].key)}>
          Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
