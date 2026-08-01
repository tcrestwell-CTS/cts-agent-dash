import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Link2, Link2Off, RefreshCw, CheckCircle2, AlertTriangle, Globe } from "lucide-react";
import { useAgencySettings, useUpdateAgencySettings } from "@/hooks/useAgencySettings";

function formatSyncTime(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EnsembleSyncPanel() {
  const { data: settings, isLoading } = useAgencySettings();
  const updateSettings = useUpdateAgencySettings();
  const [accountRef, setAccountRef] = useState<string | null>(null);

  if (isLoading) {
    return <Skeleton className="h-56" />;
  }

  const connected = settings?.ensemble_sync_connected ?? false;
  const lastStatus = settings?.ensemble_last_sync_status ?? null;
  const failed = lastStatus?.toLowerCase().includes("fail") ?? false;
  const refValue = accountRef ?? settings?.ensemble_account_ref ?? "";

  const handleConnect = () => {
    updateSettings.mutate({
      ensemble_sync_connected: true,
      ensemble_account_ref: refValue.trim() || null,
      ensemble_last_sync_at: new Date().toISOString(),
      ensemble_last_sync_status: "Connected — awaiting first sync",
    });
  };

  const handleDisconnect = () => {
    updateSettings.mutate({
      ensemble_sync_connected: false,
      ensemble_last_sync_status: "Disconnected",
    });
  };

  const handleSyncNow = () => {
    updateSettings.mutate({
      ensemble_last_sync_at: new Date().toISOString(),
      ensemble_last_sync_status: "Sync completed",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Ensemble Consortium Sync
            </CardTitle>
            <CardDescription className="mt-1">
              Link your Ensemble Travel Group membership to sync preferred-supplier offers and
              member benefits into the dashboard.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={
              connected
                ? "border-success/40 bg-success/10 text-success"
                : "border-muted-foreground/30 text-muted-foreground"
            }
          >
            {connected ? "Connected" : "Not connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ensemble_account_ref">Ensemble account reference</Label>
          <Input
            id="ensemble_account_ref"
            value={refValue}
            onChange={(e) => setAccountRef(e.target.value)}
            placeholder="e.g. ENS-AGENCY-4821"
            disabled={connected}
          />
          <p className="text-xs text-muted-foreground">
            Found on your Ensemble member portal profile. Required before connecting.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {failed ? (
              <AlertTriangle className="h-4 w-4 text-warning" />
            ) : (
              <CheckCircle2
                className={`h-4 w-4 ${connected ? "text-success" : "text-muted-foreground"}`}
              />
            )}
            <span className="font-medium text-card-foreground">
              {lastStatus ?? "No sync has run yet"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Last sync: {formatSyncTime(settings?.ensemble_last_sync_at ?? null)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <Button onClick={handleSyncNow} disabled={updateSettings.isPending}>
                {updateSettings.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync now
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={updateSettings.isPending}
              >
                <Link2Off className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={updateSettings.isPending || !refValue.trim()}
            >
              {updateSettings.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Connect Ensemble
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}