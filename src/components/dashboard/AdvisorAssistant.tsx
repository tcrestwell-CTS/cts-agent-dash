import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Phone, CheckCircle2 } from "lucide-react";
import { Panel } from "@/components/patterns/Panel";

interface AdvisorAssistantProps {
  followUps: number;
  paymentsDue: number;
  confirmedTrips: number;
}

export function AdvisorAssistant({ followUps, paymentsDue, confirmedTrips }: AdvisorAssistantProps) {
  const navigate = useNavigate();

  // Pick the most impactful insight to show
  let message = "";
  let actionLabel = "";
  let actionHref = "";
  let ActionIcon = CheckCircle2;

  if (followUps > 0) {
    message = `You have ${followUps} quote${followUps > 1 ? "s" : ""} waiting for follow-up. Sending a reminder today increases conversion by 30%.`;
    actionLabel = "Send Reminder";
    actionHref = "/trips";
    ActionIcon = Send;
  } else if (paymentsDue > 0) {
    message = `${paymentsDue} payment${paymentsDue > 1 ? "s are" : " is"} coming due. Confirming early keeps your pipeline moving.`;
    actionLabel = "Review Payments";
    actionHref = "/trips";
    ActionIcon = Phone;
  } else if (confirmedTrips > 0) {
    message = `${confirmedTrips} trip${confirmedTrips > 1 ? "s" : ""} confirmed — great momentum! Consider reaching out with pre-departure info.`;
    actionLabel = "View Trips";
    actionHref = "/trips";
    ActionIcon = CheckCircle2;
  } else {
    message = "Your pipeline is clear. A great time to reach out to past clients or follow up on new leads.";
    actionLabel = "View Clients";
    actionHref = "/contacts";
    ActionIcon = Phone;
  }

  return (
    <Panel className="border-accent/20 bg-gradient-to-br from-accent/5 via-card to-accent/10">
      <div className="flex items-start gap-3 p-[14px]">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-accent/10">
          <Sparkles className="h-4 w-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 text-[14.5px] font-semibold text-foreground">Advisor Assistant</h3>
          <p className="mb-3 text-[13.5px] text-muted-foreground">{message}</p>
          <Button size="sm" variant="default" className="gap-1.5 text-[13px]" onClick={() => navigate(actionHref)}>
            <ActionIcon className="h-3.5 w-3.5" />
            {actionLabel}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
