import { useNavigate } from "react-router-dom";
import { Phone, CreditCard, GraduationCap, Plane, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";

interface NextActionsProps {
  followUps: number;
  paymentsDue: number;
  departuresSoon: number;
  loading?: boolean;
}

interface ActionItem {
  label: string;
  icon: React.ElementType;
  href: string;
  urgent: boolean;
}

export function NextActions({ followUps, paymentsDue, departuresSoon, loading }: NextActionsProps) {
  const navigate = useNavigate();

  if (loading) return null;

  const actions: ActionItem[] = [];

  if (followUps > 0) {
    actions.push({
      label: `Follow up with ${followUps} quote${followUps > 1 ? "s" : ""}`,
      icon: Phone,
      href: "/trips",
      urgent: true,
    });
  }

  if (paymentsDue > 0) {
    actions.push({
      label: `${paymentsDue} client payment${paymentsDue > 1 ? "s" : ""} due`,
      icon: CreditCard,
      href: "/trips",
      urgent: true,
    });
  }

  if (departuresSoon > 0) {
    actions.push({
      label: `${departuresSoon} departure${departuresSoon > 1 ? "s" : ""} this week`,
      icon: Plane,
      href: "/trips",
      urgent: departuresSoon >= 3,
    });
  }

  // Always show at least one action
  if (actions.length === 0) {
    actions.push({
      label: "New supplier training available",
      icon: GraduationCap,
      href: "/training",
      urgent: false,
    });
  }

  return (
    <Panel>
      <PanelHeader title="Next Actions" />
      <PanelBody className="space-y-2">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => navigate(action.href)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-[9px] border px-3 py-2.5 text-left transition-colors",
              action.urgent
                ? "border-destructive/15 bg-destructive/5 hover:bg-destructive/10"
                : "border-border bg-muted/50 hover:bg-muted"
            )}
          >
            <action.icon
              className={cn("h-4 w-4 shrink-0", action.urgent ? "text-destructive" : "text-accent")}
            />
            <span className="flex-1 text-[13.5px] font-medium text-foreground">{action.label}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
          </button>
        ))}
      </PanelBody>
    </Panel>
  );
}
