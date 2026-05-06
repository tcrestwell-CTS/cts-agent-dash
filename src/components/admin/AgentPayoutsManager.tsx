import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Banknote, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgentPayoutSettings } from "@/components/settings/AgentPayoutSettings";
import { toast } from "sonner";

interface PayoutRow {
  user_id: string;
  payout_method: string | null;
  payee_name: string | null;
  business_name: string | null;
  account_number_last4: string | null;
  bank_name: string | null;
  updated_at: string | null;
}

interface VendorRow {
  agent_user_id: string;
  qbo_vendor_id: string;
  vendor_display_name: string | null;
  last_synced_at: string | null;
}

export function AgentPayoutsManager() {
  const qc = useQueryClient();
  const { data: profiles, isLoading: profilesLoading } = useTeamProfiles();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: payouts, isLoading: pLoading } = useQuery({
    queryKey: ["agent-payouts-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agent_payout_accounts")
        .select("user_id,payout_method,payee_name,business_name,account_number_last4,bank_name,updated_at");
      if (error) throw error;
      return data as PayoutRow[];
    },
  });

  const { data: mappings } = useQuery({
    queryKey: ["qbo-agent-vendor-mappings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("qbo_agent_vendor_mappings")
        .select("agent_user_id,qbo_vendor_id,vendor_display_name,last_synced_at");
      if (error) throw error;
      return data as VendorRow[];
    },
  });

  const payoutMap = useMemo(() => {
    const m = new Map<string, PayoutRow>();
    (payouts ?? []).forEach((p) => m.set(p.user_id, p));
    return m;
  }, [payouts]);

  const vendorMap = useMemo(() => {
    const m = new Map<string, VendorRow>();
    (mappings ?? []).forEach((v) => m.set(v.agent_user_id, v));
    return m;
  }, [mappings]);

  const handleSync = async (agentUserId: string) => {
    setSyncingId(agentUserId);
    try {
      const { data, error } = await supabase.functions.invoke("qbo-sync-agent-vendor", {
        body: { agent_user_id: agentUserId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Synced to QBO vendor ${(data as any)?.vendor_display_name ?? ""}`);
      qc.invalidateQueries({ queryKey: ["qbo-agent-vendor-mappings"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to sync to QuickBooks");
    } finally {
      setSyncingId(null);
    }
  };

  if (profilesLoading || pLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading payout details…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          <CardTitle>Agent Commission Payouts</CardTitle>
        </div>
        <CardDescription>
          Banking & payee info for each agent. Sync to QuickBooks to create or update the
          commission vendor record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(profiles ?? []).map((p) => {
          const payout = payoutMap.get(p.user_id);
          const vendor = vendorMap.get(p.user_id);
          const hasInfo = !!payout;
          return (
            <div
              key={p.user_id}
              className="flex flex-wrap items-center justify-between gap-3 border border-border/50 rounded-lg p-3"
            >
              <div className="min-w-[180px]">
                <div className="font-medium">{p.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {payout?.payee_name || payout?.business_name || "No payee on file"}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {hasInfo ? (
                  <>
                    <Badge variant="outline" className="uppercase">
                      {payout!.payout_method ?? "—"}
                    </Badge>
                    {payout?.account_number_last4 && (
                      <span className="text-muted-foreground">
                        {payout.bank_name ?? "Bank"} ••••{payout.account_number_last4}
                      </span>
                    )}
                  </>
                ) : (
                  <Badge variant="secondary">Not set up</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {vendor ? (
                  <Badge variant="outline" className="gap-1">
                    <ExternalLink className="h-3 w-3" />
                    QBO Vendor #{vendor.qbo_vendor_id}
                  </Badge>
                ) : (
                  <span>No QBO vendor</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingId(p.user_id)}>
                  {hasInfo ? "Edit" : "Add Info"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSync(p.user_id)}
                  disabled={!hasInfo || syncingId === p.user_id}
                >
                  {syncingId === p.user_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-1">Sync to QBO</span>
                </Button>
              </div>
            </div>
          );
        })}
        {(profiles ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No agents found.</p>
        )}
      </CardContent>

      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Agent Payout</DialogTitle>
          </DialogHeader>
          {editingId && <AgentPayoutSettings targetUserId={editingId} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}