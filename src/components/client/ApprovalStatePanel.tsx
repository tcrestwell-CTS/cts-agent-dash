import { CheckCircle2, Clock, Lock, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Kind = "itinerary" | "budget";

interface Props {
  kind: Kind;
  /** Has the agent published this trip? */
  published: boolean;
  /** Has the client already approved an itinerary? (also gates budget) */
  approved: boolean;
  /** Optional name of the approved itinerary, shown in the success state */
  approvedName?: string;
  /**
   * Optional permission flag. Pass `false` only when the viewer is in a read-only
   * context (e.g. admin portal preview) and cannot click Approve.
   * Defaults to true (viewer is the client).
   */
  canApprove?: boolean;
  /** Click handler to switch the user to the tab where Approve lives (Overview/Itinerary). */
  onGoToApproveTab?: () => void;
}

/**
 * Explains why an Approve button is or isn't available on the
 * Itinerary / Budget tabs of the client portal.
 */
export function ApprovalStatePanel({
  kind,
  published,
  approved,
  approvedName,
  canApprove = true,
  onGoToApproveTab,
}: Props) {
  const label = kind === "itinerary" ? "Itinerary" : "Budget";

  // 1. Already approved — success state
  if (approved) {
    return (
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-primary">{label} approved</p>
            <p className="text-muted-foreground mt-0.5">
              {kind === "itinerary"
                ? `You've approved${approvedName ? ` "${approvedName}"` : " this itinerary"}. Your agent has been notified and Pay Now options are unlocked on the Payments tab.`
                : `Your budget is locked in based on your approved itinerary${approvedName ? ` ("${approvedName}")` : ""}. Pay Now options are available on the Payments tab.`}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 2. Not yet published by the agent — Approve hidden because nothing to approve
  if (!published) {
    return (
      <Card className="border-muted bg-muted/30">
        <CardContent className="flex items-start gap-3 py-4">
          <Lock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">{label} not yet published</p>
            <p className="text-muted-foreground mt-0.5">
              Your travel agent is still finalizing your {label.toLowerCase()}. The
              <span className="font-medium"> Approve {label}</span> button will appear here once it's been sent for your review.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 3. Read-only viewer (e.g. admin preview) — explain why button is missing
  if (!canApprove) {
    return (
      <Card className="border-muted bg-muted/30">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Read-only preview</p>
            <p className="text-muted-foreground mt-0.5">
              You're viewing this {label.toLowerCase()} as the agent. The
              <span className="font-medium"> Approve {label}</span> button is only shown to the client when they sign in to their portal.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 4. Published, awaiting approval — point client to where the button is
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="flex items-start gap-3 py-4">
        <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-amber-700 dark:text-amber-400">
            Awaiting your approval
          </p>
          <p className="text-muted-foreground mt-0.5">
            {kind === "itinerary"
              ? "Review the itinerary options below, then approve your preferred one to unlock payment."
              : "This budget is tied to your itinerary. Approve your preferred itinerary to lock in pricing and unlock Pay Now options."}
          </p>
          {onGoToApproveTab && (
            <Button size="sm" variant="outline" className="mt-2" onClick={onGoToApproveTab}>
              {kind === "budget" ? "Go to Itinerary Options" : "View Itinerary Options"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
