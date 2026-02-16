import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Users, FileText, DollarSign, BarChart3, CheckCircle2, XCircle, AlertTriangle, Copy, Check } from "lucide-react";
import { useQBOConnection } from "@/hooks/useQBOConnection";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
          <Button size="sm" onClick={handleConnect}>Connect</Button>
        </div>

        {/* Redirect URI mismatch error */}
        {connectError && (
          <div className="px-4 pb-3">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-3">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">Redirect URI Mismatch</p>
                  <p className="text-xs text-destructive/80">
                    The URI sent to Intuit does not match any registered Redirect URI in your app.
                  </p>
                </div>
              </div>

              {/* Attempted URI */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-destructive/90">Attempted URI:</p>
                <div className="flex items-center gap-2 bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5">
                  <code className="text-xs text-destructive font-mono flex-1 break-all">{connectError.redirect_uri || redirectUri}</code>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyUri(connectError.redirect_uri || redirectUri)}>
                    {copied === (connectError.redirect_uri || redirectUri) ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </Button>
                </div>
              </div>

              {/* Allowed URIs from backend */}
              {connectError.allowed_redirect_uris && connectError.allowed_redirect_uris.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive/90">Allowed URIs (from backend config):</p>
                  <div className="space-y-1">
                    {connectError.allowed_redirect_uris.map((uri) => (
                      <div key={uri} className="flex items-center gap-2 bg-background border border-border rounded px-2 py-1.5">
                        <code className="text-xs text-foreground font-mono flex-1 break-all">{uri}</code>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyUri(uri)}>
                          {copied === uri ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-destructive/70">
                <strong>Fix:</strong> Copy the attempted URI above and add it to your Intuit Developer app's <strong>Redirect URIs</strong> section, then add its origin to <strong>QBO_ALLOWED_ORIGINS</strong>.
              </p>
            </div>
          </div>
        )}

        {/* All required redirect URIs */}
        <div className="px-4 pb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-800">Required Redirect URIs</p>
                <p className="text-xs text-amber-700">
                  Ensure <strong>all</strong> of these URIs are listed in your Intuit Developer app's <strong>Redirect URIs</strong> and their origins are in <strong>QBO_ALLOWED_ORIGINS</strong>:
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              {allRequiredUris.map((uri) => (
                <div key={uri} className="flex items-center gap-2 bg-background border border-border rounded px-2 py-1.5">
                  <code className="text-xs text-foreground flex-1 truncate">{uri}</code>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyUri(uri)}>
                    {copied === uri ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-1">
              Current origin: <code className="bg-amber-100 px-1 rounded">{window.location.origin}</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

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
