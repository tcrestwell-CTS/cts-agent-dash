import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Maps QuickBooks accounts to the roles the CRM-driven QBO push logic relies on.
 *
 * Architecture: the CRM is the system of record. When a trip installment or loan
 * installment is marked paid, DB triggers post deposits to QuickBooks. The
 * trigger logic looks up the destination accounts here by role, so admins can
 * change the chart of accounts without re-deploying.
 */

type QboAccount = {
  qbo_id: string;
  name: string;
  account_type: string;
  account_sub_type: string | null;
};

type Role = {
  key:
    | "trip_clearing"
    | "loan_principal_clearing"
    | "loan_interest_clearing"
    | "loan_receivable"
    | "interest_income"
    | "operating_bank";
  label: string;
  hint: string;
  filter: (a: QboAccount) => boolean;
};

const ROLES: Role[] = [
  {
    key: "trip_clearing",
    label: "Trip Stripe Clearing",
    hint: "Receives trip installment payments from Stripe before payout to operating bank.",
    filter: (a) => a.account_type === "Other Current Asset" || a.account_type === "Bank",
  },
  {
    key: "loan_principal_clearing",
    label: "Loan Principal Clearing",
    hint: "Receives the principal portion of every loan installment.",
    filter: (a) => a.account_type === "Other Current Asset" || a.account_type === "Bank",
  },
  {
    key: "loan_interest_clearing",
    label: "Loan Interest Clearing",
    hint: "Receives the interest portion of every loan installment.",
    filter: (a) => a.account_type === "Other Current Asset" || a.account_type === "Bank",
  },
  {
    key: "loan_receivable",
    label: "Loan Receivable",
    hint: "Outstanding loan principal balance. Credited as principal payments post.",
    filter: (a) => a.account_type === "Other Current Asset",
  },
  {
    key: "interest_income",
    label: "Interest / Financing Income",
    hint: "Credited when the interest portion of a loan installment posts.",
    filter: (a) => a.account_type === "Income" || a.account_type === "Other Income",
  },
  {
    key: "operating_bank",
    label: "Operating Bank",
    hint: "Physical bank account that receives Stripe payouts. Used as the destination for clearing-account transfers.",
    filter: (a) => a.account_type === "Bank",
  },
];

export function QBOAccountMappingCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<QboAccount[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [{ data: accts, error: aErr }, { data: maps, error: mErr }] = await Promise.all([
        supabase
          .from("qbo_accounts")
          .select("qbo_id, name, account_type, account_sub_type")
          .eq("active", true)
          .order("account_type")
          .order("name"),
        supabase.from("qbo_account_mappings").select("role, qbo_account_id"),
      ]);
      if (aErr) throw aErr;
      if (mErr) throw mErr;
      setAccounts((accts as QboAccount[]) || []);
      const initial: Record<string, string> = {};
      (maps || []).forEach((m: any) => {
        initial[m.role] = m.qbo_account_id;
      });
      setMappings(initial);
    } catch (err: any) {
      toast.error(`Failed to load QBO accounts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const accountsByRole = useMemo(() => {
    const out: Record<string, QboAccount[]> = {};
    for (const role of ROLES) {
      out[role.key] = accounts.filter(role.filter);
    }
    return out;
  }, [accounts]);

  async function save() {
    setSaving(true);
    try {
      const rows = ROLES.filter((r) => mappings[r.key]).map((r) => {
        const acct = accounts.find((a) => a.qbo_id === mappings[r.key]);
        return {
          role: r.key,
          qbo_account_id: mappings[r.key],
          qbo_account_name: acct?.name || null,
          updated_at: new Date().toISOString(),
        };
      });
      if (rows.length === 0) {
        toast.info("Nothing to save");
        return;
      }
      const { error } = await supabase
        .from("qbo_account_mappings")
        .upsert(rows, { onConflict: "role" });
      if (error) throw error;
      toast.success("Account mappings saved");
      await loadAll();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          QuickBooks Account Mapping
        </CardTitle>
        <CardDescription>
          Map each role to the QuickBooks account the CRM should post to. Required for trip
          installment deposits, loan installment deposits, and Stripe payout transfers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
          </div>
        ) : (
          <>
            {ROLES.map((role) => (
              <div key={role.key} className="grid gap-2">
                <Label className="font-medium">{role.label}</Label>
                <Select
                  value={mappings[role.key] || ""}
                  onValueChange={(v) =>
                    setMappings((m) => ({ ...m, [role.key]: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsByRole[role.key]?.map((a) => (
                      <SelectItem key={a.qbo_id} value={a.qbo_id}>
                        {a.name} <span className="text-muted-foreground">— {a.account_type}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{role.hint}</p>
              </div>
            ))}

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save mappings
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}