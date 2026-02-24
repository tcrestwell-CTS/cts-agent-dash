import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Check, X, Loader2, ShieldAlert } from "lucide-react";
import { usePendingOverrides, useApproveOverride, useRejectOverride } from "@/hooks/usePendingOverrides";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";

interface HighValueBooking {
  id: string;
  booking_reference: string;
  destination: string;
  owner_agent: string | null;
  gross_sales: number;
  created_at: string;
  client: { name: string } | null;
  agent: { full_name: string | null } | null;
}

function useHighValueApprovals() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ["high-value-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`id, booking_reference, destination, owner_agent, gross_sales, created_at, user_id, clients (name)`)
        .eq("approval_required", true)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");

      return (data || []).map((b) => {
        const agent = profiles?.find((p) => p.user_id === b.user_id);
        return {
          ...b,
          client: b.clients as { name: string } | null,
          agent: agent ? { full_name: agent.full_name } : null,
        } as HighValueBooking;
      });
    },
    enabled: !!user && !!isAdmin,
  });
}

function useApproveHighValue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("bookings")
        .update({
          approval_required: false,
          status: "confirmed",
          override_approved_by: user.id,
          override_approved_at: new Date().toISOString(),
        })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["high-value-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("High-value booking approved");
    },
    onError: () => toast.error("Failed to approve booking"),
  });
}

function useRejectHighValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({
          approval_required: false,
          status: "cancelled",
          cancellation_reason: "Rejected by admin — exceeded approval threshold",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["high-value-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("High-value booking rejected");
    },
    onError: () => toast.error("Failed to reject booking"),
  });
}

export function PendingOverridesCard() {
  const { data: pendingOverrides, isLoading: overridesLoading } = usePendingOverrides();
  const { data: highValueBookings, isLoading: hvLoading } = useHighValueApprovals();
  const approveOverride = useApproveOverride();
  const rejectOverride = useRejectOverride();
  const approveHV = useApproveHighValue();
  const rejectHV = useRejectHighValue();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isLoading = overridesLoading || hvLoading;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
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
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (<Skeleton key={i} className="h-20" />))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasOverrides = !!pendingOverrides?.length;
  const hasHighValue = !!highValueBookings?.length;

  if (!hasOverrides && !hasHighValue) return null;

  return (
    <Card className="border-warning/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Pending Approvals
            <Badge variant="secondary" className="bg-warning/10 text-warning">
              {(pendingOverrides?.length || 0) + (highValueBookings?.length || 0)}
            </Badge>
          </CardTitle>
          {selectedIds.size > 0 && (
            <Button size="sm" onClick={handleApproveSelected} disabled={approveOverride.isPending} className="gap-2">
              {approveOverride.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve Selected ({selectedIds.size})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High-Value Booking Approvals */}
        {hasHighValue && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              High-Value Bookings
            </p>
            {highValueBookings!.map((hv) => (
              <div key={hv.id} className="flex items-center gap-4 p-3 bg-accent/5 rounded-lg border border-accent/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link to={`/bookings/${hv.id}`} className="font-medium text-primary hover:underline">
                      {hv.booking_reference}
                    </Link>
                    <Badge variant="secondary" className="bg-accent/10 text-accent text-xs">High Value</Badge>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground truncate">{hv.client?.name || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{hv.destination}</span>
                    <span className="text-muted-foreground">Agent: {hv.agent?.full_name || hv.owner_agent || "Unknown"}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-accent">{formatCurrency(hv.gross_sales)}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => approveHV.mutate(hv.id)} disabled={approveHV.isPending} className="gap-1">
                    <Check className="h-3 w-3" /> Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => rejectHV.mutate(hv.id)} disabled={rejectHV.isPending} className="gap-1 text-destructive hover:text-destructive">
                    <X className="h-3 w-3" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Commission Override Approvals */}
        {hasOverrides && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Commission Overrides</p>
            {pendingOverrides!.map((override) => (
              <div key={override.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
                <Checkbox checked={selectedIds.has(override.id)} onCheckedChange={() => handleToggle(override.id)} aria-label={`Select ${override.booking_reference}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link to={`/bookings/${override.id}`} className="font-medium text-primary hover:underline">{override.booking_reference}</Link>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground truncate">{override.client?.name || "Unknown Client"}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{override.destination}</span>
                    <span className="text-muted-foreground">Agent: {override.agent?.full_name || override.owner_agent || "Unknown"}</span>
                    <span className="text-muted-foreground">{format(parseISO(override.created_at), "MMM d, yyyy")}</span>
                  </div>
                  {override.override_notes && (
                    <p className="text-sm text-muted-foreground mt-1 italic">"{override.override_notes}"</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm text-muted-foreground line-through">{formatCurrency(override.calculated_commission)}</div>
                  <div className="font-semibold text-warning">{formatCurrency(override.commission_override_amount)}</div>
                  <div className="text-xs text-muted-foreground">+{formatCurrency(override.commission_override_amount - override.calculated_commission)}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => approveOverride.mutate(override.id)} disabled={approveOverride.isPending} className="gap-1">
                    <Check className="h-3 w-3" /> Approve
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => rejectOverride.mutate(override.id)} disabled={rejectOverride.isPending} className="gap-1 text-destructive hover:text-destructive">
                    <X className="h-3 w-3" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
