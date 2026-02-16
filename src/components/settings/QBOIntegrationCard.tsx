import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Users, FileText, DollarSign, BarChart3, CheckCircle2, XCircle, AlertTriangle, Copy, Check, Clock, Building2, Key, Shield, HelpCircle } from "lucide-react";
import { useQBOConnection } from "@/hooks/useQBOConnection";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, formatDistanceToNow, isPast, isBefore, addDays } from "date-fns";
import { QBOSetupWizard } from "./QBOSetupWizard";

interface FinancialSummary {
  profit_and_loss: {
    total_income: number;
    total_expenses: number;
    net_income: number;
  } | null;
  balance_sheet: {
    total_assets: number;
  } | null;
}

export function QBOIntegrationCard() {
  const {
    status,
    loading,
    syncing,
    connect,
    handleCallback,
    disconnect,
    syncClients,
    syncPayments,
    getFinancialSummary,
  } = useQBOConnection();

  const [financials, setFinancials] = useState<FinancialSummary | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [connectError, setConnectError] = useState<{
    current_origin: string;
    allowed_origins: string[];
    redirect_uri?: string;
    allowed_redirect_uris?: string[];
  } | null>(null);
  const redirectUri = `${window.location.origin}/settings?tab=integrations`;

  // Known domains that should be registered
  const knownDomains = [
    "https://agents.crestwelltravels.com",
    "https://id-preview--8ab51332-288c-4764-b4d9-392cc428e2fb.lovable.app",
    "https://8ab51332-288c-4764-b4d9-392cc428e2fb.lovableproject.com",
  ];
  const allRequiredUris = [...new Set([
    ...knownDomains.map(d => `${d}/settings?tab=integrations`),
    redirectUri,
  ])];

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const realmId = params.get("realmId");
    const stateParam = params.get("state");

    if (code && realmId && stateParam) {
      handleCallback(code, realmId, stateParam);
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("realmId");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const loadFinancials = async () => {
    setLoadingFinancials(true);
    const data = await getFinancialSummary();
    setFinancials(data);
    setLoadingFinancials(false);
  };

  useEffect(() => {
    if (status.connected) {
      loadFinancials();
    }
  }, [status.connected]);

  if (loading) {
    return (
      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16 mt-1" />
          </div>
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
    );
  }

  const copyUri = (uri: string) => {
    navigator.clipboard.writeText(uri);
    setCopied(uri);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleConnect = async () => {
    setConnectError(null);
    const result = await connect();
    if (result && (result.error === "redirect_uri_mismatch" || result.error === "redirect_uri_exact_mismatch")) {
      setConnectError({
        current_origin: result.current_origin || window.location.origin,
        allowed_origins: result.allowed_origins || [],
        redirect_uri: result.redirect_uri,
        allowed_redirect_uris: result.allowed_redirect_uris,
      });
    }
  };

  if (!status.connected) {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <span className="text-green-700 font-bold text-sm">QB</span>
            </div>
            <div>
              <p className="font-medium text-card-foreground">QuickBooks Online</p>
              <p className="text-sm text-muted-foreground">Not connected</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWizard((v) => !v)}
              className="gap-1 text-muted-foreground"
            >
              <HelpCircle className="h-4 w-4" />
              {showWizard ? "Hide Guide" : "Setup Guide"}
            </Button>
            {!showWizard && (
              <Button size="sm" onClick={handleConnect}>
                Connect
              </Button>
            )}
          </div>
        </div>

        {showWizard && (
          <div className="px-4 pb-4">
            <QBOSetupWizard onConnect={handleConnect} connectError={connectError} />
          </div>
        )}

        {/* Error shown outside wizard when wizard is hidden */}
        {!showWizard && connectError && (
          <div className="px-4 pb-3">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">Redirect URI Mismatch</p>
                  <p className="text-xs text-destructive/80">
                    Click <strong>Setup Guide</strong> for step-by-step instructions to resolve this.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const tokenExpiry = status.connection?.token_expires_at
    ? new Date(status.connection.token_expires_at)
    : null;
  const tokenExpired = tokenExpiry ? isPast(tokenExpiry) : false;
  const tokenExpiringSoon = tokenExpiry
    ? !tokenExpired && isBefore(tokenExpiry, addDays(new Date(), 1))
    : false;
  const connectedSince = status.connection?.created_at
    ? new Date(status.connection.created_at)
    : null;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
            <span className="text-green-700 font-bold text-sm">QB</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-card-foreground">QuickBooks Online</p>
              <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {status.connection?.company_name || "Sandbox Company"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>

      {/* Connection Status Panel */}
      <div className="p-4 border-b border-border">
        <p className="text-sm font-medium text-card-foreground mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Connection Status
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Company */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              Company
            </div>
            <p className="text-sm font-medium text-card-foreground">
              {status.connection?.company_name || "—"}
            </p>
          </div>

          {/* Realm ID */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Key className="h-3 w-3" />
              Realm ID
            </div>
            <p className="text-sm font-mono text-card-foreground">
              {status.connection?.realm_id || "—"}
            </p>
          </div>

          {/* Token Status */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Token Status
            </div>
            <div className="flex items-center gap-2">
              {tokenExpired ? (
                <Badge variant="destructive" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Expired
                </Badge>
              ) : tokenExpiringSoon ? (
                <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Expiring Soon
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Valid
                </Badge>
              )}
              {tokenExpiry && (
                <span className="text-xs text-muted-foreground">
                  {tokenExpired
                    ? `Expired ${formatDistanceToNow(tokenExpiry, { addSuffix: true })}`
                    : `Expires ${formatDistanceToNow(tokenExpiry, { addSuffix: true })}`}
                </span>
              )}
            </div>
          </div>

          {/* Connected Since */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Connected Since
            </div>
            <p className="text-sm text-card-foreground">
              {connectedSince
                ? format(connectedSince, "MMM d, yyyy 'at' h:mm a")
                : "—"}
            </p>
          </div>
        </div>

        {tokenExpired && (
          <div className="mt-3 bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-destructive">Token expired</p>
              <p className="text-xs text-destructive/80">
                Disconnect and reconnect to refresh your QuickBooks authorization.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sync Actions */}
      <div className="p-4 space-y-3">
        <p className="text-sm font-medium text-card-foreground">Sync Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2"
            onClick={() => syncClients()}
            disabled={!!syncing}
          >
            {syncing === "clients" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Sync Clients
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2"
            onClick={() => syncPayments()}
            disabled={!!syncing}
          >
            {syncing === "payments" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
            Sync Payments
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2"
            onClick={loadFinancials}
            disabled={loadingFinancials}
          >
            {loadingFinancials ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
            Refresh Financials
          </Button>
        </div>
      </div>

      {/* Financial Summary */}
      {financials?.profit_and_loss && (
        <div className="px-4 pb-4">
          <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Income (This Month)</p>
              <p className="text-sm font-semibold text-green-600">
                ${financials.profit_and_loss.total_income.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expenses</p>
              <p className="text-sm font-semibold text-destructive">
                ${financials.profit_and_loss.total_expenses.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Income</p>
              <p className="text-sm font-semibold text-card-foreground">
                ${financials.profit_and_loss.net_income.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
