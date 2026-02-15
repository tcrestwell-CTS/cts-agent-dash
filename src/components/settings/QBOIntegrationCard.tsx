import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Users, FileText, DollarSign, BarChart3, CheckCircle2, XCircle } from "lucide-react";
import { useQBOConnection } from "@/hooks/useQBOConnection";
import { Skeleton } from "@/components/ui/skeleton";

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

  if (!status.connected) {
    return (
      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
            <span className="text-green-700 font-bold text-sm">QB</span>
          </div>
          <div>
            <p className="font-medium text-card-foreground">QuickBooks Online</p>
            <p className="text-sm text-muted-foreground">Not connected</p>
          </div>
        </div>
        <Button size="sm" onClick={connect}>Connect</Button>
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
