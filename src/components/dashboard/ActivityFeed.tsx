import { CheckCircle2, Send, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, PanelHeader, PanelBody, EmptyState } from "@/components/patterns/Panel";
import { SemanticStatusPill, type SemanticStatus } from "@/components/patterns/StatusPill";

interface ActivityItem {
  id: string;
  status: string;
  trips?: { clients?: { name: string } | null } | null;
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

function getActivityLabel(item: ActivityItem) {
  const clientName = item.trips?.clients?.name || "Client";
  switch (item.status) {
    case "confirmed":
      return { icon: CheckCircle2, text: `Booking Confirmed → ${clientName}`, color: "text-success" };
    case "pending":
      return { icon: Send, text: `Quote Sent → ${clientName}`, color: "text-accent" };
    default:
      return { icon: FileText, text: `${item.status} → ${clientName}`, color: "text-muted-foreground" };
  }
}

// Maps a booking status onto the closest semantic color for the
// status pill indicator — purely a visual affordance, not a status source of truth.
function toPillStatus(status: string): SemanticStatus {
  switch (status) {
    case "confirmed":
      return "success";
    case "pending":
      return "warning";
    default:
      return "muted";
  }
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Panel>
      <PanelHeader title="Recent Activity" />
      <PanelBody>
        {!items || items.length === 0 ? (
          <EmptyState title="No recent activity" message="Booking updates will appear here as they happen." />
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const activity = getActivityLabel(item);
              const Icon = activity.icon;
              return (
                <div key={item.id} className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4 shrink-0", activity.color)} />
                  <p className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">{activity.text}</p>
                  <SemanticStatusPill status={toPillStatus(item.status)} label={item.status} className="shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
