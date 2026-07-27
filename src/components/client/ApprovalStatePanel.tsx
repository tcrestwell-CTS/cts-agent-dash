import { CheckCircle2, Clock, Lock, FileText, DollarSign, CreditCard, ArrowRight, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type Kind = "itinerary" | "budget";
type StepState = "done" | "active" | "locked";

interface Props {
  kind: Kind;
  /** Has the agent published this trip? */
  published: boolean;
  /** Has the client already approved an itinerary? (also gates budget) */
  approved: boolean;
  /** Optional name of the approved itinerary, shown in the success state */
  approvedName?: string;
  /** Read-only context (e.g. admin preview). Hides client CTAs. */
  canApprove?: boolean;
  /** Switch the user to the tab where Approve lives (usually Overview). */
  onGoToApproveTab?: () => void;
  /** Optional trip id — enables the "Pay Now" CTA once approved. */
  tripId?: string;
}

/**
 * Visual 3-step approval stepper used on the Itinerary and Budget tabs.
 * Shows clients exactly what to do next: Review & Approve → Confirm Budget → Pay.
 */
export function ApprovalStatePanel({
  kind,
  published,
  approved,
  approvedName,
  canApprove = true,
  onGoToApproveTab,
  tripId,
}: Props) {
  const navigate = useNavigate();

  // Derive states. Currently budget unlocks at the same moment itinerary is approved.
  const itineraryState: StepState = approved ? "done" : published ? "active" : "locked";
  const budgetState: StepState = approved ? "done" : "locked";
  const payState: StepState = approved ? "active" : "locked";

  const steps = [
    {
      n: 1,
      key: "itinerary" as const,
      icon: FileText,
      title: "Review & approve your itinerary",
      doneText: `Approved${approvedName ? ` — "${approvedName}"` : ""}`,
      activeText: "Compare the options your advisor sent and approve the one you want.",
      lockedText: "Your advisor is still finalizing your options. We'll notify you when they're ready.",
      state: itineraryState,
    },
    {
      n: 2,
      key: "budget" as const,
      icon: DollarSign,
      title: "Confirm the budget",
      doneText: "Budget locked in based on your approved itinerary.",
      activeText: "The budget locks in automatically when you approve an itinerary above.",
      lockedText: "Approve an itinerary first — pricing is tied to your chosen option.",
      state: budgetState,
    },
    {
      n: 3,
      key: "pay" as const,
      icon: CreditCard,
      title: "Choose how to pay",
      doneText: "Ready when you are.",
      activeText: "Card, financing through Affirm, or send your card to your advisor — your call.",
      lockedText: "Payment options unlock the moment your itinerary is approved.",
      state: payState,
    },
  ];

  // Headline summary at the top of the card
  const headline = !canApprove
    ? { tone: "muted" as const, label: "Read-only preview", desc: "You're viewing what the client sees. Approve & pay actions only appear in the client's own portal." }
    : approved
    ? { tone: "success" as const, label: "Step 3 of 3 — Ready to pay", desc: "Your trip is approved. Pick a payment method whenever you're ready." }
    : published
    ? { tone: "active" as const, label: `Step 1 of 3 — Awaiting your approval`, desc: kind === "budget"
        ? "Pricing locks in once you approve an itinerary. Head to the Itinerary tab to choose."
        : "Pick your preferred itinerary option below to lock in pricing and unlock payment." }
    : { tone: "muted" as const, label: "Waiting on your advisor", desc: "We'll email you the moment your itinerary is ready to review." };

  const toneClasses = {
    success: "border-primary/40 bg-primary/5",
    active: "border-warning/40 bg-warning/[0.04]",
    muted: "border-muted bg-muted/30",
  } as const;

  const headlineTextClasses = {
    success: "text-primary",
    active: "text-warning dark:text-warning",
    muted: "text-foreground",
  } as const;

  const HeadIcon = !canApprove ? Eye : approved ? CheckCircle2 : published ? Clock : Lock;

  return (
    <Card className={cn("overflow-hidden", toneClasses[headline.tone])}>
      <CardContent className="p-5 space-y-5">
        {/* Headline summary */}
        <div className="flex items-start gap-3">
          <HeadIcon className={cn("h-5 w-5 mt-0.5 shrink-0", headlineTextClasses[headline.tone])} />
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-semibold", headlineTextClasses[headline.tone])}>
              {headline.label}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">{headline.desc}</p>
          </div>
        </div>

        {/* Stepper */}
        <ol className="relative space-y-3">
          {steps.map((s, idx) => {
            const isActiveForThisTab = s.key === kind && s.state === "active";
            const StateIcon = s.state === "done" ? CheckCircle2 : s.state === "locked" ? Lock : s.icon;

            const rowTone =
              s.state === "done"
                ? "bg-background border-primary/30"
                : s.state === "active"
                ? "bg-background border-warning/40 ring-1 ring-warning/20"
                : "bg-background/60 border-border opacity-70";

            const numberTone =
              s.state === "done"
                ? "bg-primary text-primary-foreground border-primary"
                : s.state === "active"
                ? "bg-warning text-white border-warning"
                : "bg-muted text-muted-foreground border-border";

            const text =
              s.state === "done" ? s.doneText : s.state === "active" ? s.activeText : s.lockedText;

            return (
              <li
                key={s.key}
                className={cn(
                  "relative flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  rowTone,
                  isActiveForThisTab && "shadow-sm"
                )}
              >
                {/* Step number badge */}
                <div
                  className={cn(
                    "h-7 w-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold",
                    numberTone
                  )}
                >
                  {s.state === "done" ? <CheckCircle2 className="h-4 w-4" /> : s.n}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StateIcon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        s.state === "done"
                          ? "text-primary"
                          : s.state === "active"
                          ? "text-warning"
                          : "text-muted-foreground"
                      )}
                    />
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    {s.state === "done" && (
                      <Badge variant="secondary" className="h-5 text-[10px] bg-primary/10 text-primary border-primary/20">
                        Done
                      </Badge>
                    )}
                    {s.state === "active" && (
                      <Badge className="h-5 text-[10px] bg-warning hover:bg-warning text-white border-0">
                        Do this next
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</p>

                  {/* Per-step CTA */}
                  {canApprove && s.state === "active" && (
                    <div className="mt-2">
                      {s.key === "itinerary" && kind === "budget" && onGoToApproveTab && (
                        <Button size="sm" variant="outline" onClick={onGoToApproveTab}>
                          View itinerary options <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      )}
                      {s.key === "pay" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate(tripId ? `/client/trips/${tripId}?tab=payments` : "/client/payments")
                          }
                        >
                          <CreditCard className="h-3.5 w-3.5 mr-1.5" /> See payment options
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
