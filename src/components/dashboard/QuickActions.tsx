import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Send, BookOpen, FileText, RefreshCw, Globe, Scale } from "lucide-react";
import { useIsAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const actions = [
  {
    label: "New Booking",
    icon: Plus,
    variant: "default" as const,
    href: "/bookings?action=new",
  },
  {
    label: "Send Quote",
    icon: Send,
    variant: "outline" as const,
    href: "/contacts",
  },
  {
    label: "Booking Portals",
    icon: Globe,
    variant: "outline" as const,
    href: "/trips?tab=portals",
  },
  {
    label: "Training",
    icon: BookOpen,
    variant: "outline" as const,
    href: "/training",
  },
  {
    label: "Reports",
    icon: FileText,
    variant: "outline" as const,
    href: "/commission-report",
  },
];

export function QuickActions() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [isRunningAutomation, setIsRunningAutomation] = useState(false);

  const handleActionClick = (action: typeof actions[0]) => {
    if (action.href) {
      navigate(action.href);
    }
  };

  const handleRunAutomation = async () => {
    setIsRunningAutomation(true);
    try {
      const { data, error } = await supabase.functions.invoke("booking-orchestrator/automate-status");

      if (error) {
        console.error("Automation error:", error);
        toast.error("Failed to run automation", {
          description: error.message,
        });
        return;
      }

      const result = data as {
        success: boolean;
        bookings_updated: number;
        bookings_notified: number;
        agents_processed: number;
        errors: string[];
      };

      if (result.success) {
        toast.success("Automation completed", {
          description: `Updated ${result.bookings_updated} booking(s), sent ${result.bookings_notified} notification(s)`,
        });
      } else {
        toast.error("Automation failed", {
          description: result.errors?.join(", ") || "Unknown error",
        });
      }
    } catch (err) {
      console.error("Error running automation:", err);
      toast.error("Failed to run automation");
    } finally {
      setIsRunningAutomation(false);
    }
  };

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
            onClick={() => handleActionClick(action)}
          >
            <action.icon className="h-5 w-5" />
            <span className="text-sm">{action.label}</span>
          </Button>
        ))}
        {isAdmin && (
          <>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate("/qbo-health")}
            >
              <Scale className="h-5 w-5" />
              <span className="text-sm">Stripe Recon</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2 border-dashed"
              onClick={handleRunAutomation}
              disabled={isRunningAutomation}
            >
              <RefreshCw className={`h-5 w-5 ${isRunningAutomation ? "animate-spin" : ""}`} />
              <span className="text-sm">
                {isRunningAutomation ? "Running..." : "Run Automation"}
              </span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
