// ═══════════════════════════════════════════════════════════════
// FILE: src/pages/ReconSettings.tsx
// Admin screen: account config + entity mappings + CSV export
// ═══════════════════════════════════════════════════════════════

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings, Save, Link2, Download, RefreshCw,
  CheckCircle2, AlertTriangle, Loader2, Plus, Trash2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useAdmin";
import { Navigate } from "react-router-dom";
import { exportToCSV } from "@/lib/csvExport";

// ─── Types ────────────────────────────────────────────────────

interface AccountConfig {
  id: string;
  qbo_bank_account_id: string | null;
  stripe_clearing_account_id: string | null;
  stripe_fees_account_id: string | null;
  undeposited_funds_account_id: string | null;
  ar_account_id: string | null;
  ap_account_id: string | null;
  default_vendor_payment_account_id: string | null;
  amount_tolerance: number;
  date_window_days: number;
  auto_match_threshold: number;
  approval_required_above: number;
  closed_period_cutoff: string | null;
  allow_auto_post: boolean;
}

interface QBOAccount {
  qbo_id: string;
  name: string;
  account_type: string;
  account_sub_type: string;
}

interface EntityMapping {
  id: string;
  mapping_type: string;
  crm_id: string | null;
  qbo_id: string | null;
  stripe_id: string | null;
  verified: boolean;
  created_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────

function useAccountConfig() {
  return useQuery({
    queryKey: ["recon-account-config"],
    queryFn: async (): Promise<AccountConfig> => {
      const { data, error } = await supabase
        .from("recon_account_config")
        .select("*")
        .eq("company_id", "crestwell")
        .single();
      if (error) throw error;
      return data as AccountConfig;
    },
  });
}

function useQBOAccounts() {
  return useQuery({
    queryKey: ["qbo-accounts-list"],
    queryFn: async (): Promise<QBOAccount[]> => {
      const { data, error } = await supabase
        .from("qbo_accounts")
        .select("qbo_id, name, account_type, account_sub_type")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as QBOAccount[];
    },
  });
}

function useEntityMappings(type?: string) {
  return useQuery({
    queryKey: ["entity-mappings", type],
    queryFn: async (): Promise<EntityMapping[]> => {
      let q = supabase
        .from("recon_entity_mappings")
        .select("*")
        .order("created_at", { ascending: false });
      if (type) q = q.eq("mapping_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data as EntityMapping[];
    },
  });
}

// ─── Account Config Tab ───────────────────────────────────────

const REQUIRED_ACCOUNT_FIELDS: { field: keyof AccountConfig; label: string }[] = [
  { field: "qbo_bank_account_id", label: "Operating Bank Account" },
  { field: "stripe_clearing_account_id", label: "Stripe Clearing Account" },
  { field: "stripe_fees_account_id", label: "Stripe Fees Expense" },
  { field: "undeposited_funds_account_id", label: "Undeposited Funds" },
  { field: "ar_account_id", label: "Accounts Receivable (A/R)" },
  { field: "ap_account_id", label: "Accounts Payable (A/P)" },
  { field: "default_vendor_payment_account_id", label: "Default Vendor Payment Account" },
];

function AccountConfigTab() {
  const { data: config, isLoading } = useAccountConfig();
  const { data: accounts } = useQBOAccounts();
  const qc = useQueryClient();

  const [form, setForm] = useState<Partial<AccountConfig>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (config) {
      setForm(config);
      setDirty(false);
    }
  }, [config]);

  const set = (key: keyof AccountConfig, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const missing = REQUIRED_ACCOUNT_FIELDS.filter((f) => !form[f.field]);
      if (missing.length > 0) {
        throw new Error(
          `Please select an account for: ${missing.map((m) => m.label).join(", ")}`
        );
      }
      const { error } = await supabase
        .from("recon_account_config")
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq("company_id", "crestwell");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Config saved");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["recon-account-config"] });
    },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const missingRequired = REQUIRED_ACCOUNT_FIELDS.filter((f) => !form[f.field]);

  const bankAccounts = accounts?.filter((a) =>
    ["Bank", "Credit Card"].includes(a.account_type)
  ) || [];
  const expenseAccounts = accounts?.filter((a) =>
    a.account_type === "Expense"
  ) || [];
  const allAccounts = accounts || [];

  const AccountSelect = ({
    label, field, options, description,
  }: {
    label: string;
    field: keyof AccountConfig;
    options: QBOAccount[];
    description?: string;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : (
        <Select
          value={(form[field] as string) || "__none__"}
          onValueChange={(v) => set(field, v === "__none__" ? null : v)}
        >
          <SelectTrigger className="font-mono text-sm">
            <SelectValue placeholder="Select QBO account..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Not set —</SelectItem>
            {options.map((a) => (
              <SelectItem key={a.qbo_id} value={a.qbo_id}>
                {a.name}
                <span className="text-xs text-muted-foreground ml-2">
                  {a.account_sub_type}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* QBO Account Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">QBO Account Mappings</CardTitle>
          <CardDescription>
            Map Crestwell transaction types to the correct QuickBooks accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <AccountSelect
            label="Operating Bank Account"
            field="qbo_bank_account_id"
            options={bankAccounts}
            description="Main checking account where Stripe deposits land"
          />
          <AccountSelect
            label="Stripe Clearing Account"
            field="stripe_clearing_account_id"
            options={allAccounts}
            description="Intermediate account for Stripe gross payments before fee netting"
          />
          <AccountSelect
            label="Stripe Fees Expense"
            field="stripe_fees_account_id"
            options={expenseAccounts}
            description="Where Stripe processing fees are recorded"
          />
          <AccountSelect
            label="Undeposited Funds"
            field="undeposited_funds_account_id"
            options={allAccounts}
            description="Holding account for payments not yet deposited"
          />
          <AccountSelect
            label="Accounts Receivable (A/R)"
            field="ar_account_id"
            options={allAccounts}
          />
          <AccountSelect
            label="Accounts Payable (A/P)"
            field="ap_account_id"
            options={allAccounts}
          />
          <AccountSelect
            label="Default Vendor Payment Account"
            field="default_vendor_payment_account_id"
            options={bankAccounts}
            description="Default bank account for supplier/vendor payments"
          />
        </CardContent>
      </Card>

      {/* Matching Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matching Rules</CardTitle>
          <CardDescription>
            Controls how the reconciliation engine scores and auto-approves matches
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Amount Tolerance ($)</Label>
            <p className="text-xs text-muted-foreground">
              Max dollar variance to still consider amounts matching
            </p>
            <Input
              type="number"
              step="0.01"
              value={form.amount_tolerance ?? 1.00}
              onChange={(e) => set("amount_tolerance", parseFloat(e.target.value))}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Date Window (days)</Label>
            <p className="text-xs text-muted-foreground">
              ± days to still consider dates matching
            </p>
            <Input
              type="number"
              min={0}
              max={30}
              value={form.date_window_days ?? 3}
              onChange={(e) => set("date_window_days", parseInt(e.target.value))}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Auto-Match Threshold (%)</Label>
            <p className="text-xs text-muted-foreground">
              Confidence score above which matches are auto-approved
            </p>
            <Input
              type="number"
              min={50}
              max={100}
              value={form.auto_match_threshold ?? 95}
              onChange={(e) => set("auto_match_threshold", parseInt(e.target.value))}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Require Approval Above ($)</Label>
            <p className="text-xs text-muted-foreground">
              QBO writes above this amount require admin approval
            </p>
            <Input
              type="number"
              step="1"
              value={form.approval_required_above ?? 500}
              onChange={(e) => set("approval_required_above", parseFloat(e.target.value))}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Closed Period Cutoff</Label>
            <p className="text-xs text-muted-foreground">
              No QBO writes will be made for transactions before this date
            </p>
            <Input
              type="date"
              value={form.closed_period_cutoff || ""}
              onChange={(e) => set("closed_period_cutoff", e.target.value || null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Allow Auto-Post to QBO</Label>
            <p className="text-xs text-muted-foreground">
              If enabled, high-confidence matches post to QBO without approval
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Switch
                checked={form.allow_auto_post ?? false}
                onCheckedChange={(v) => set("allow_auto_post", v)}
              />
              <span className="text-sm">
                {form.allow_auto_post ? (
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    ⚠ Auto-post enabled
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    Manual approval required
                  </Badge>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Required account mappings are missing</p>
            <p className="text-xs mt-1">
              {missingRequired.map((m) => m.label).join(", ")}
            </p>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending || missingRequired.length > 0}
          className="min-w-32"
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {dirty ? "Save Changes" : "Saved"}
        </Button>
      </div>
    </div>
  );
}

// ─── Entity Mappings Tab ──────────────────────────────────────

const MAPPING_TYPE_LABELS: Record<string, string> = {
  crm_client_to_qbo_customer:  "CRM Client → QBO Customer",
  crm_supplier_to_qbo_vendor:  "CRM Supplier → QBO Vendor",
  stripe_customer_to_crm_client: "Stripe Customer → CRM Client",
  crm_booking_to_qbo_invoice:  "CRM Booking → QBO Invoice",
};

function EntityMappingsTab() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({
    mapping_type: "crm_client_to_qbo_customer",
    crm_id: "",
    qbo_id: "",
    stripe_id: "",
  });

  const { data: mappings, isLoading } = useEntityMappings(
    typeFilter !== "all" ? typeFilter : undefined
  );
  const { data: qboCustomers } = useQuery({
    queryKey: ["qbo-customers-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("qbo_customers")
        .select("qbo_id, display_name, email")
        .order("display_name");
      return data || [];
    },
  });
  const { data: crmClients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, email")
        .order("name");
      return data || [];
    },
  });
  const { data: qboVendors } = useQuery({
    queryKey: ["qbo-vendors-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("qbo_vendors")
        .select("qbo_id, display_name, email")
        .eq("active", true)
        .order("display_name");
      return data || [];
    },
  });
  const { data: crmSuppliers } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, contact_email")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });
  const { data: qboInvoices } = useQuery({
    queryKey: ["qbo-invoices-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("qbo_invoices")
        .select("qbo_id, doc_number, total_amt, txn_date")
        .order("txn_date", { ascending: false })
        .limit(500);
      return data || [];
    },
  });
  const { data: crmBookings } = useQuery({
    queryKey: ["bookings-list-mapping"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, confirmation_number, total_price, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const qc = useQueryClient();

  const addMapping = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("recon_entity_mappings").insert({
        ...newMapping,
        crm_id: newMapping.crm_id || null,
        qbo_id: newMapping.qbo_id || null,
        stripe_id: newMapping.stripe_id || null,
        verified: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mapping added");
      setAddOpen(false);
      setNewMapping({ mapping_type: "crm_client_to_qbo_customer", crm_id: "", qbo_id: "", stripe_id: "" });
      qc.invalidateQueries({ queryKey: ["entity-mappings"] });
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recon_entity_mappings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mapping removed");
      qc.invalidateQueries({ queryKey: ["entity-mappings"] });
    },
  });

  const exportMappings = () => {
    if (!mappings) return;
    exportToCSV(
      mappings.map((m) => ({
        type: MAPPING_TYPE_LABELS[m.mapping_type] || m.mapping_type,
        crm_id: m.crm_id || "",
        qbo_id: m.qbo_id || "",
        stripe_id: m.stripe_id || "",
        verified: m.verified ? "Yes" : "No",
        created: m.created_at,
      })),
      "entity_mappings"
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(MAPPING_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportMappings}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Mapping
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>CRM ID</TableHead>
                <TableHead>QBO ID</TableHead>
                <TableHead>Stripe ID</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : mappings?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No entity mappings yet — run a QBO cache sync to auto-populate
                  </TableCell>
                </TableRow>
              ) : (
                mappings?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {MAPPING_TYPE_LABELS[m.mapping_type] || m.mapping_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.crm_id || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{m.qbo_id || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{m.stripe_id || "—"}</TableCell>
                    <TableCell>
                      {m.verified ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:bg-red-50"
                        onClick={() => deleteMapping.mutate(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Mapping Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Entity Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Mapping Type</Label>
              <Select
                value={newMapping.mapping_type}
                onValueChange={(v) => setNewMapping((m) => ({ ...m, mapping_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MAPPING_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(() => {
              type Opt = { value: string; label: string };
              const toOpts = (
                rows: Array<Record<string, unknown>> | undefined,
                idKey: string,
                fmt: (r: Record<string, unknown>) => string,
              ): Opt[] =>
                (rows || [])
                  .map((r) => ({ value: String(r[idKey] ?? ""), label: fmt(r) }))
                  .filter((o) => o.value);

              let crmLabel = "CRM ID";
              let crmOpts: Opt[] = [];
              let qboLabel = "QBO ID";
              let qboOpts: Opt[] = [];

              switch (newMapping.mapping_type) {
                case "crm_client_to_qbo_customer":
                  crmLabel = "CRM Client";
                  crmOpts = toOpts(crmClients, "id", (c) =>
                    `${c.name}${c.email ? ` (${c.email})` : ""}`);
                  qboLabel = "QBO Customer";
                  qboOpts = toOpts(qboCustomers, "qbo_id", (c) =>
                    `${c.display_name}${c.email ? ` (${c.email})` : ""}`);
                  break;
                case "crm_supplier_to_qbo_vendor":
                  crmLabel = "CRM Supplier";
                  crmOpts = toOpts(crmSuppliers, "id", (s) =>
                    `${s.name}${s.contact_email ? ` (${s.contact_email})` : ""}`);
                  qboLabel = "QBO Vendor";
                  qboOpts = toOpts(qboVendors, "qbo_id", (v) =>
                    `${v.display_name}${v.email ? ` (${v.email})` : ""}`);
                  break;
                case "crm_booking_to_qbo_invoice":
                  crmLabel = "CRM Booking";
                  crmOpts = toOpts(crmBookings, "id", (b) =>
                    `${b.confirmation_number || "(no conf #)"} — $${Number(b.total_price || 0).toFixed(2)}`);
                  qboLabel = "QBO Invoice";
                  qboOpts = toOpts(qboInvoices, "qbo_id", (i) =>
                    `#${i.doc_number || i.qbo_id} — $${Number(i.total_amt || 0).toFixed(2)} (${i.txn_date || ""})`);
                  break;
                case "stripe_customer_to_crm_client":
                  crmLabel = "CRM Client";
                  crmOpts = toOpts(crmClients, "id", (c) =>
                    `${c.name}${c.email ? ` (${c.email})` : ""}`);
                  break;
              }

              const isStripe = newMapping.mapping_type === "stripe_customer_to_crm_client";

              return (
                <>
                  <div className="space-y-1.5">
                    <Label>{crmLabel}</Label>
                    <Select
                      value={newMapping.crm_id}
                      onValueChange={(v) => setNewMapping((m) => ({ ...m, crm_id: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder={`Select ${crmLabel.toLowerCase()}...`} /></SelectTrigger>
                      <SelectContent>
                        {crmOpts.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!isStripe && (
                    <div className="space-y-1.5">
                      <Label>{qboLabel}</Label>
                      <Select
                        value={newMapping.qbo_id}
                        onValueChange={(v) => setNewMapping((m) => ({ ...m, qbo_id: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder={`Select ${qboLabel.toLowerCase()}...`} /></SelectTrigger>
                        <SelectContent>
                          {qboOpts.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {isStripe && (
                    <div className="space-y-1.5">
                      <Label>Stripe Customer ID</Label>
                      <Input
                        placeholder="cus_..."
                        value={newMapping.stripe_id}
                        onChange={(e) => setNewMapping((m) => ({ ...m, stripe_id: e.target.value }))}
                        className="font-mono text-sm"
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMapping.mutate()}
              disabled={addMapping.isPending || !newMapping.mapping_type}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Add Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Export Tab ───────────────────────────────────────────────

function ExportTab() {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportData = async (type: string) => {
    setExporting(type);
    try {
      let data: Record<string, unknown>[] = [];
      let filename = type;

      if (type === "matches") {
        const { data: rows } = await supabase
          .from("recon_matches")
          .select("*")
          .order("created_at", { ascending: false });
        data = (rows || []).map((r) => ({
          id: r.id,
          match_type: r.match_type,
          confidence: r.confidence_score,
          status: r.status,
          crm_amount: r.crm_amount,
          qbo_amount: r.qbo_amount,
          stripe_amount: r.stripe_amount,
          variance: r.amount_variance,
          explanation: r.match_explanation,
          recommended_action: r.recommended_action,
          created: r.created_at,
        }));
        filename = "recon_matches";
      } else if (type === "exceptions") {
        const { data: rows } = await supabase
          .from("exception_queue")
          .select("*")
          .order("created_at", { ascending: false });
        data = (rows || []).map((r) => ({
          id: r.id,
          type: r.exception_type,
          source: r.source_system,
          record_type: r.source_record_type,
          record_id: r.source_record_id,
          description: r.description,
          amount: r.amount,
          status: r.status,
          resolution: r.resolution_notes,
          created: r.created_at,
        }));
        filename = "recon_exceptions";
      } else if (type === "audit") {
        const { data: rows } = await supabase
          .from("recon_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000);
        data = (rows || []).map((r) => ({
          id: r.id,
          actor: r.actor_email,
          action: r.action,
          source: r.source_system,
          record_type: r.record_type,
          record_id: r.record_id,
          qbo_object: r.qbo_object_id,
          created: r.created_at,
        }));
        filename = "recon_audit_log";
      } else if (type === "stripe_payments") {
        const { data: rows } = await supabase
          .from("stripe_payments")
          .select("*")
          .order("stripe_created_at", { ascending: false });
        data = (rows || []).map((r) => ({
          payment_intent: r.stripe_payment_intent_id,
          charge_id: r.stripe_charge_id,
          invoice: r.invoice_number,
          customer_email: r.customer_email,
          customer_name: r.customer_name,
          gross: r.gross_amount,
          fee: r.stripe_fee,
          net: r.net_amount,
          status: r.status,
          method: r.payment_method,
          date: r.stripe_created_at,
        }));
        filename = "stripe_payments";
      }

      exportToCSV(data, filename);
      toast.success(`${filename}.csv downloaded`);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(null);
    }
  };

  const reports = [
    { key: "matches",         label: "Reconciliation Matches",    desc: "All matches with confidence scores and status" },
    { key: "exceptions",      label: "Exception Queue",           desc: "All flagged items needing manual review" },
    { key: "audit",           label: "Audit Log",                 desc: "Last 1,000 audit events with actor and action" },
    { key: "stripe_payments", label: "Stripe Payments",           desc: "All ingested Stripe payment records with fees" },
  ];

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <Card key={r.key}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">{r.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportData(r.key)}
              disabled={exporting === r.key}
            >
              {exporting === r.key ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function ReconSettings() {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) return (
    <DashboardLayout>
      <div className="p-6"><Skeleton className="h-8 w-48" /></div>
    </DashboardLayout>
  );

  if (!isAdmin) return <Navigate to="/recon" replace />;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Reconciliation Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Account mappings, matching rules, entity links, and data exports
          </p>
        </div>

        <Tabs defaultValue="accounts">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="accounts">Account Config</TabsTrigger>
            <TabsTrigger value="mappings">Entity Mappings</TabsTrigger>
            <TabsTrigger value="exports">Exports</TabsTrigger>
          </TabsList>
          <TabsContent value="accounts" className="mt-5">
            <AccountConfigTab />
          </TabsContent>
          <TabsContent value="mappings" className="mt-5">
            <EntityMappingsTab />
          </TabsContent>
          <TabsContent value="exports" className="mt-5">
            <ExportTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
