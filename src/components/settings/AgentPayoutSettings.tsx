import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Banknote, Lock, Loader2 } from "lucide-react";
import { useAgentPayoutAccount, AgentPayoutAccount, PayoutMethod } from "@/hooks/useAgentPayoutAccount";

const empty: Partial<AgentPayoutAccount> = {
  payout_method: "ach",
  payee_name: "",
  business_name: "",
  tax_form: "W9",
  tax_id_last4: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
  email: "",
  phone: "",
  bank_name: "",
  account_holder_name: "",
  account_type: "checking",
  routing_number: "",
  account_number: "",
  zelle_handle: "",
  paypal_email: "",
  venmo_handle: "",
  notes: "",
};

interface Props {
  /** When viewing/editing on behalf of another agent (admin only) */
  targetUserId?: string;
}

export function AgentPayoutSettings({ targetUserId }: Props) {
  const { data, isLoading, save } = useAgentPayoutAccount(targetUserId);
  const [form, setForm] = useState<Partial<AgentPayoutAccount>>(empty);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({ ...empty, ...data, account_number: "" });
    }
  }, [data]);

  const set = (k: keyof AgentPayoutAccount, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    const payload: any = { ...form };
    // Strip empty account_number so we don't blank existing value
    if (!payload.account_number) delete payload.account_number;
    // Normalize blanks to null for consistency
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") payload[k] = null;
    });
    save.mutate(payload);
  };

  const method = (form.payout_method ?? "ach") as PayoutMethod;
  const showBank = method === "ach" || method === "wire";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          <CardTitle>Commission Payout</CardTitle>
        </div>
        <CardDescription>
          Banking and payee information used to pay your commissions. This data is encrypted in
          transit, restricted to you and agency admins, and used to create your QuickBooks vendor
          record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Only you and agency administrators can view this information. Account numbers are
            stored securely and only the last 4 digits are shown after saving.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Payee identity */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Payout Method</Label>
                <Select value={method} onValueChange={(v) => set("payout_method", v as PayoutMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ach">ACH (Direct Deposit)</SelectItem>
                    <SelectItem value="check">Paper Check</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    <SelectItem value="zelle">Zelle</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="venmo">Venmo</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tax Form</Label>
                <Select
                  value={form.tax_form ?? "W9"}
                  onValueChange={(v) => set("tax_form", v as any)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="W9">W-9 (US)</SelectItem>
                    <SelectItem value="W8BEN">W-8BEN (Non-US)</SelectItem>
                    <SelectItem value="none">None on file</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payee Name (legal)</Label>
                <Input value={form.payee_name ?? ""} onChange={(e) => set("payee_name", e.target.value)} />
              </div>
              <div>
                <Label>Business / DBA Name (optional)</Label>
                <Input value={form.business_name ?? ""} onChange={(e) => set("business_name", e.target.value)} />
              </div>
              <div>
                <Label>Tax ID — last 4 digits (SSN/EIN)</Label>
                <Input
                  inputMode="numeric"
                  maxLength={4}
                  value={form.tax_id_last4 ?? ""}
                  onChange={(e) => set("tax_id_last4", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                />
              </div>
              <div>
                <Label>Remittance Email</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Mailing Address</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Address Line 1</Label>
                  <Input value={form.address_line1 ?? ""} onChange={(e) => set("address_line1", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Address Line 2</Label>
                  <Input value={form.address_line2 ?? ""} onChange={(e) => set("address_line2", e.target.value)} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>State</Label>
                    <Input maxLength={2} value={form.state ?? ""} onChange={(e) => set("state", e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <Label>Postal Code</Label>
                    <Input value={form.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={form.country ?? "US"} onChange={(e) => set("country", e.target.value.toUpperCase())} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Bank details */}
            {showBank && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Bank Account ({method.toUpperCase()})</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Bank Name</Label>
                    <Input value={form.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Account Holder Name</Label>
                    <Input value={form.account_holder_name ?? ""} onChange={(e) => set("account_holder_name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Account Type</Label>
                    <Select value={form.account_type ?? "checking"} onValueChange={(v) => set("account_type", v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Checking</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Routing Number (9 digits)</Label>
                    <Input
                      inputMode="numeric"
                      maxLength={9}
                      value={form.routing_number ?? ""}
                      onChange={(e) => set("routing_number", e.target.value.replace(/\D/g, "").slice(0, 9))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>
                      Account Number{" "}
                      {data?.account_number_last4 && (
                        <span className="text-xs text-muted-foreground font-normal">
                          (on file: ••••{data.account_number_last4})
                        </span>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type={showAccount ? "text" : "password"}
                        inputMode="numeric"
                        value={form.account_number ?? ""}
                        placeholder={data?.account_number_last4 ? "Enter to replace" : "Account number"}
                        onChange={(e) => set("account_number", e.target.value.replace(/\D/g, ""))}
                      />
                      <Button type="button" variant="outline" onClick={() => setShowAccount((s) => !s)}>
                        {showAccount ? "Hide" : "Show"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Alt handles */}
            {(method === "zelle" || method === "paypal" || method === "venmo") && (
              <div className="grid md:grid-cols-3 gap-4">
                {method === "zelle" && (
                  <div>
                    <Label>Zelle (email or phone)</Label>
                    <Input value={form.zelle_handle ?? ""} onChange={(e) => set("zelle_handle", e.target.value)} />
                  </div>
                )}
                {method === "paypal" && (
                  <div>
                    <Label>PayPal Email</Label>
                    <Input type="email" value={form.paypal_email ?? ""} onChange={(e) => set("paypal_email", e.target.value)} />
                  </div>
                )}
                {method === "venmo" && (
                  <div>
                    <Label>Venmo Handle</Label>
                    <Input value={form.venmo_handle ?? ""} onChange={(e) => set("venmo_handle", e.target.value)} />
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Any special instructions for accounting…"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Payout Details
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}