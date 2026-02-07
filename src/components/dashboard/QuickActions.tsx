import { Button } from "@/components/ui/button";
import { Plus, Send, BookOpen, FileText } from "lucide-react";

const actions = [
  {
    label: "New Booking",
    icon: Plus,
    variant: "default" as const,
  },
  {
    label: "Send Quote",
    icon: Send,
    variant: "outline" as const,
  },
  {
    label: "Training",
    icon: BookOpen,
    variant: "outline" as const,
  },
  {
    label: "Reports",
    icon: FileText,
    variant: "outline" as const,
  },
];

export function QuickActions() {
  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
      <h3 className="text-lg font-semibold text-card-foreground mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant}
            className="h-auto py-4 flex-col gap-2"
          >
            <action.icon className="h-5 w-5" />
            <span className="text-sm">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
