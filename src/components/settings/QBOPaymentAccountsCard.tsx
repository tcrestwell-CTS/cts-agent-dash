import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, AlertTriangle, CheckCircle2, RefreshCw, Banknote } from "lucide-react";
import { toast } from "sonner";

interface QboAccount {
  id: string;
  name: string;
  type: "Bank" | "CreditCard" | string;
  subtype?: string;
}

/**
 * Lets admins pick the default Bank + Credit Card accounts QuickBooks
 * should use for BillPayment (supplier paid) and Stripe net-deposit JEs.
 * Without this, BillPayments fail with
 * "Select an account for this transaction."
 */
export function QBOPaymentAccountsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<QboAccount[]>([]);
  const [bankId, setBankId] = useState<string>("");
  const [ccId, setCcId] = useState<string>("");
  const [initial, setInitial] = useState<{ bankId: string; ccId: string }>({ bankId: "", ccId: "" });

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Not signed in");

      // Load current defaults from connection row
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      const { data: conn } = await supabase
        .from("qbo_connections")
        .select("default_bank_account_id, default_cc_account_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      const curBank = (conn as any)?.default_bank_account_id || "";
      const curCc = (conn as any)?.default_cc_account_id || "";
      setBankId(curBank);
      setCcId(curCc);
      setInitial({ bankId: curBank, ccId: curCc });

      // Load available QBO accounts
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=list-payment-accounts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed to load QBO accounts");
      setAccounts(json.accounts || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load payment accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const banks = accounts.filter((a) => a.type === "Bank");
  const cards = accounts.filter((a) => a.type === "CreditCard");
  const dirty = bankId !== initial.bankId || ccId !== initial.ccId;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const bank = banks.find((a) => a.id === bankId);
      const cc = cards.find((a) => a.id === ccId);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qbo-sync?action=set-default-accounts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            default_bank_account_id: bankId || null,
            default_bank_account_name: bank?.name || null,
            default_cc_account_id: ccId || null,
            default_cc_account_name: cc?.name || null,
          }),
        }
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Save failed");
      setInitial({ bankId, ccId });
      toast.success("QuickBooks default accounts saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-border p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Banknote className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium text-card-foreground">Default Payment Accounts</p>
            <p className="text-xs text-muted-foreground">
              Used by QuickBooks for supplier bill payments and Stripe net deposits.
              Required to fix the "Select an account for this transaction" error.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadAll} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts from QuickBooks…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Bank Account (Checks / ACH)</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger>
                <SelectValue placeholder={banks.length ? "Select a bank account" : "No bank accounts in QBO"} />
              </SelectTrigger>
              <SelectContent>
                {banks.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Credit Card Account (CC payments)</Label>
            <Select value={ccId} onValueChange={setCcId}>
              <SelectTrigger>
                <SelectValue placeholder={cards.length ? "Select a credit card" : "No credit card accounts in QBO"} />
              </SelectTrigger>
              <SelectContent>
                {cards.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {!loading && !initial.bankId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            No bank account configured yet — supplier BillPayments will continue to fail until one is selected and saved.
          </p>
        </div>
      )}

      {!loading && initial.bankId && !dirty && (
        <div className="flex items-center gap-2 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Defaults configured.
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Save defaults
        </Button>
      </div>
    </div>
  );
}