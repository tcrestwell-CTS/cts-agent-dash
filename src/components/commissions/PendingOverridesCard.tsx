import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Check, X, Loader2 } from "lucide-react";
import { usePendingOverrides, useApproveOverride, useRejectOverride } from "@/hooks/usePendingOverrides";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { useState } from "react";

export function PendingOverridesCard() {
  const { data: pendingOverrides, isLoading } = usePendingOverrides();
  const approveOverride = useApproveOverride();
  const rejectOverride = useRejectOverride();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleApproveSelected = async () => {
    for (const id of selectedIds) {
      await approveOverride.mutateAsync(id);
    }
    setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Pending Commission Overrides
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pendingOverrides?.length) {
    return null;
  }

  return (
    <Card className="border-warning/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Pending Commission Overrides
            <Badge variant="secondary" className="bg-warning/10 text-warning">
              {pendingOverrides.length}
            </Badge>
          </CardTitle>
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              onClick={handleApproveSelected}
              disabled={approveOverride.isPending}
              className="gap-2"
            >
              {approveOverride.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approve Selected ({selectedIds.size})
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          These bookings have commission overrides higher than the calculated amount and require approval.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingOverrides.map((override) => (
            <div
              key={override.id}
              className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border"
            >
              <Checkbox
                checked={selectedIds.has(override.id)}
                onCheckedChange={() => handleToggle(override.id)}
                aria-label={`Select ${override.booking_reference}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Link
                    to={`/bookings/${override.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {override.booking_reference}
                  </Link>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {override.client?.name || "Unknown Client"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {override.destination}
                  </span>
                  <span className="text-muted-foreground">
                    Agent: {override.agent?.full_name || override.owner_agent || "Unknown"}
                  </span>
                  <span className="text-muted-foreground">
                    {format(parseISO(override.created_at), "MMM d, yyyy")}
                  </span>
                </div>
                {override.override_notes && (
                  <p className="text-sm text-muted-foreground mt-1 italic">
                    "{override.override_notes}"
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm text-muted-foreground line-through">
                  {formatCurrency(override.calculated_commission)}
                </div>
                <div className="font-semibold text-warning">
                  {formatCurrency(override.commission_override_amount)}
                </div>
                <div className="text-xs text-muted-foreground">
                  +{formatCurrency(override.commission_override_amount - override.calculated_commission)}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => approveOverride.mutate(override.id)}
                  disabled={approveOverride.isPending}
                  className="gap-1"
                >
                  <Check className="h-3 w-3" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => rejectOverride.mutate(override.id)}
                  disabled={rejectOverride.isPending}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
