import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, X, ArrowRight, ArrowLeft, Eye, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePublishReadiness } from "@/components/trips/PublishTripButton";
import { cn } from "@/lib/utils";

const KEY = (id: string) => `tripBuilderGuided:${id}`;

export function enableGuidedBuilder(tripId: string) {
  try { localStorage.setItem(KEY(tripId), "1"); } catch { /* ignore */ }
}
export function isGuidedBuilder(tripId?: string) {
  if (!tripId) return false;
  try { return localStorage.getItem(KEY(tripId)) !== "0"; } catch { return true; }
}
export function disableGuidedBuilder(tripId: string) {
  try { localStorage.setItem(KEY(tripId), "0"); } catch { /* ignore */ }
}

export const PAYMENT_SETTINGS_ANCHOR = "trip-payment-settings";
export const PUBLISH_ANCHOR = "trip-publish-button";

type StepKey = "basics" | "tripPage" | "itinerary" | "pricing" | "payments" | "publish";

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

  const current: StepKey = new URLSearchParams(location.search).get("builder") === "trip-page"
    ? "tripPage"
    : location.pathname.endsWith("/itinerary")
    ? "itinerary"
    : /tab=(bookings|payments)/.test(location.search)
      ? "pricing"
      : location.hash === `#${PUBLISH_ANCHOR}`
        ? "publish"
        : location.hash === `#${PAYMENT_SETTINGS_ANCHOR}`
          ? "payments"
          : "basics";

  const steps: { key: StepKey; label: string; done: boolean; hint: string }[] = [
    { key: "basics", label: "Trip Basics", done: !!trip.trip_name && !!trip.depart_date && passed("client"), hint: "Name, dates, destination and client" },
    { key: "tripPage", label: "Trip Page", done: !!trip.cover_image_url && !!trip.notes, hint: "Cover image and client-facing overview" },
    { key: "itinerary", label: "Itinerary", done: passed("itinerary"), hint: "Add days and items" },
    { key: "pricing", label: "Pricing & Packages", done: passed("pricing"), hint: "Add bookings or priced items" },
    { key: "payments", label: "Payment Plan", done: scheduledCount > 0, hint: "Choose deposit / schedule and create payments" },
    { key: "publish", label: "Review & Publish", done: !!trip.published_at && requiredOk, hint: "Resolve required items, then publish" },
  ];

  const scrollTo = (id: string) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);

  const go = (k: StepKey) => {
    if (k === "basics") { navigate(`/trips/${tripId}`); onEditBasics(); }
    else if (k === "tripPage") navigate(`/trips/${tripId}?builder=trip-page`);
    else if (k === "itinerary") navigate(`/trips/${tripId}/itinerary`);
    else if (k === "pricing") navigate(`/trips/${tripId}?tab=bookings`);
    else if (k === "payments") { navigate(`/trips/${tripId}#${PAYMENT_SETTINGS_ANCHOR}`); scrollTo(PAYMENT_SETTINGS_ANCHOR); }
    else { navigate(`/trips/${tripId}#${PUBLISH_ANCHOR}`); scrollTo(PUBLISH_ANCHOR); }
  };

  const idx = steps.findIndex((s) => s.key === current);
  const stepsLeft = steps.filter((s) => !s.done && s.key !== "publish").length;
  const isPublished = !!trip.published_at;
  const shareUrl = trip.share_token ? `${window.location.origin}/shared/${trip.share_token}` : null;

  return (
    <aside
      className="w-full shrink-0 space-y-4 lg:sticky lg:top-6 self-start"
      aria-label="Guided trip builder"
    >
      {/* Step list */}
      <ol className="divide-y divide-border border-b border-border">
        {steps.map((s) => {
          const isCurrent = s.key === current;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => go(s.key)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "w-full flex items-center gap-2.5 px-1.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isCurrent ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
                )}
              >
                {s.done
                  ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  : <Circle className={cn("h-4 w-4 shrink-0", isCurrent ? "text-primary" : "text-muted-foreground/50")} />}
                <span className={cn("text-[13px] truncate", isCurrent ? "font-semibold" : "font-medium", s.done && !isCurrent && "text-muted-foreground")}>
                  {s.label}
                </span>
                {isCurrent && <ArrowRight className="h-3.5 w-3.5 ml-auto text-primary shrink-0" />}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Preview / Publish */}
      <div className="space-y-2 pt-1">
        <Button
          variant="outline"
          className="w-full"
          disabled={!isPublished || !shareUrl}
          onClick={() => shareUrl && window.open(shareUrl, "_blank", "noopener")}
        >
          <Eye className="h-4 w-4 mr-1.5" />
          Preview
        </Button>
        <Button
          className="w-full"
          variant={requiredOk ? "default" : "secondary"}
          disabled={!requiredOk && current !== "publish"}
          onClick={() => go("publish")}
        >
          Publish
        </Button>
      </div>

      {/* Steps remaining hint */}
      <div className="flex items-start gap-2 pt-1">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-snug">
          {stepsLeft === 0
            ? requiredOk
              ? "All set — review and publish when ready"
              : "Review the checklist before publishing"
            : `${stepsLeft} step${stepsLeft === 1 ? "" : "s"} left before you can publish`}
        </p>
      </div>

      {/* Back / Next */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={idx <= 0} onClick={() => go(steps[idx - 1].key)}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={idx >= steps.length - 1} onClick={() => go(steps[idx + 1].key)}>
          Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      <button
        type="button"
        onClick={onExit}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" /> Exit guided mode
      </button>
    </aside>
  );
}
