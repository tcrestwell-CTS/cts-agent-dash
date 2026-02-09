import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, ChevronRight, Loader2, Plane, Calendar, MapPin, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TripStatusWorkflowProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => Promise<boolean>;
  disabled?: boolean;
}

const WORKFLOW_STATUSES = [
  { key: "planning", label: "Planning", icon: Calendar, description: "Trip is being planned" },
  { key: "booked", label: "Booked", icon: Check, description: "All bookings confirmed" },
  { key: "traveling", label: "Traveling", icon: Plane, description: "Client is on the trip" },
  { key: "completed", label: "Completed", icon: CheckCircle2, description: "Trip completed" },
] as const;

export function TripStatusWorkflow({ currentStatus, onStatusChange, disabled }: TripStatusWorkflowProps) {
  const [updating, setUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const currentIndex = WORKFLOW_STATUSES.findIndex((s) => s.key === currentStatus);
  const isCancelled = currentStatus === "cancelled";

  const handleStatusChange = async (newStatus: string) => {
    if (disabled || updating) return;
    
    setUpdating(true);
    setPendingStatus(newStatus);
    try {
      await onStatusChange(newStatus);
    } finally {
      setUpdating(false);
      setPendingStatus(null);
    }
  };

  const getNextStatus = () => {
    if (isCancelled) return null;
    const nextIndex = currentIndex + 1;
    return nextIndex < WORKFLOW_STATUSES.length ? WORKFLOW_STATUSES[nextIndex] : null;
  };

  const getPreviousStatus = () => {
    if (isCancelled) return WORKFLOW_STATUSES[0]; // Allow returning to planning from cancelled
    const prevIndex = currentIndex - 1;
    return prevIndex >= 0 ? WORKFLOW_STATUSES[prevIndex] : null;
  };

  const nextStatus = getNextStatus();
  const previousStatus = getPreviousStatus();

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Status Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {WORKFLOW_STATUSES.map((status, index) => {
              const Icon = status.icon;
              const isCompleted = !isCancelled && index < currentIndex;
              const isCurrent = !isCancelled && status.key === currentStatus;
              const isPending = pendingStatus === status.key;

              return (
                <div key={status.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                        isCompleted
                          ? "bg-primary border-primary text-primary-foreground"
                          : isCurrent
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-muted border-muted-foreground/30 text-muted-foreground"
                      )}
                    >
                      {isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs mt-2 font-medium text-center",
                        isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {status.label}
                    </span>
                  </div>
                  {index < WORKFLOW_STATUSES.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-0.5 mx-2",
                        !isCancelled && index < currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cancelled State */}
        {isCancelled && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4 text-center">
            <p className="text-destructive font-medium">This trip has been cancelled</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => handleStatusChange("planning")}
              disabled={updating}
            >
              {updating && pendingStatus === "planning" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Reactivate Trip
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        {!isCancelled && (
          <div className="flex items-center justify-between gap-4">
            <div>
              {previousStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange(previousStatus.key)}
                  disabled={updating || disabled}
                >
                  {updating && pendingStatus === previousStatus.key ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Back to {previousStatus.label}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {nextStatus ? (
                <Button
                  onClick={() => handleStatusChange(nextStatus.key)}
                  disabled={updating || disabled}
                  className="gap-2"
                >
                  {updating && pendingStatus === nextStatus.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Mark as {nextStatus.label}
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Trip Completed</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}