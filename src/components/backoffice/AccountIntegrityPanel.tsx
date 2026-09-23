import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

type DriftRow = {
  scope: string;
  record_id: string;
  label: string | null;
  field: string;
  stored_value: number | null;
  expected_value: number | null;
  difference: number | null;
};

const FIELD_LABELS: Record<string, string> = {
  gross_sales: "Booking total vs its priced items",
  total_gross_sales: "Trip total vs its bookings",
  total_paid: "Amount paid vs recorded payments",
};

const money = (n: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));

export function AccountIntegrityPanel() {
  const [rows, setRows] = useState<DriftRow[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await (supabase as any).rpc("audit_account_integrity");
      if (error) throw error;
      setRows((data || []) as DriftRow[]);
      if (!data || data.length === 0) toast.success("All client accounts balance correctly.");
    } catch (e: any) {
      toast.error(e?.message || "Could not run the account check.");
    } finally {
      setChecking(false);
    }
  };

  const runRepair = async () => {
    setRepairing(true);
    try {
      const { data, error } = await (supabase as any).rpc("repair_account_integrity");
      if (error) throw error;
      const b = (data as any)?.bookings_recalculated ?? 0;
      toast.success(`Recalculated ${b} booking${b === 1 ? "" : "s"} and refreshed all trip balances.`);
      await runCheck();
    } catch (e: any) {
      toast.error(e?.message || "Could not repair the accounts.");
    } finally {
      setRepairing(false);
    }
  };

  return (
    <Panel>
      <PanelHeader title="Account Integrity" />
      <PanelBody>
        <p className="text-sm text-muted-foreground">
          Totals, margins and balances recalculate automatically whenever priced items or payments change. Use this to
          confirm nothing has drifted, and to repair it if something has.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={runCheck} disabled={checking} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking…" : "Run check"}
          </Button>
          <Button onClick={runRepair} disabled={repairing} size="sm">
            {repairing ? "Repairing…" : "Recalculate everything"}
          </Button>
        </div>

        {rows !== null && rows.length === 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Every account matches its underlying items and payments.
          </div>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {rows.length} account{rows.length === 1 ? "" : "s"} out of step
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Record</th>
                    <th className="px-3 py-2 font-medium">Check</th>
                    <th className="px-3 py-2 text-right font-medium">Showing</th>
                    <th className="px-3 py-2 text-right font-medium">Should be</th>
                    <th className="px-3 py-2 text-right font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.scope}-${r.record_id}-${r.field}`} className="border-t border-border">
                      <td className="px-3 py-2">{r.label || r.record_id}</td>
                      <td className="px-3 py-2 text-muted-foreground">{FIELD_LABELS[r.field] || r.field}</td>
                      <td className="px-3 py-2 text-right">{money(r.stored_value)}</td>
                      <td className="px-3 py-2 text-right">{money(r.expected_value)}</td>
                      <td className="px-3 py-2 text-right font-medium">{money(r.difference)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
