import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TrendingUp, Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { useAgencyMarginRules } from "@/hooks/useAgencyMarginRules";
import { useSuppliers } from "@/hooks/useSuppliers";
import type {
  AgencyMarginRule, AgencyMarginRuleInsert,
  MarginRuleType, MarginLineType,
} from "@/types/margin";
import { RULE_TYPE_LABELS, LINE_TYPE_LABELS } from "@/types/margin";

const LINE_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  ...Object.entries(LINE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const emptyForm = (): AgencyMarginRuleInsert => ({
  name: "", line_type: null, supplier_id: null,
  rule_type: "markup_pct", rule_value: 0,
  is_active: true, priority: 0, notes: null,
});

export function MarginEngineSettings() {
  const { rules, isLoading, createRule, updateRule, deleteRule } = useAgencyMarginRules();
  const { activeSuppliers } = useSuppliers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyMarginRule | null>(null);
  const [form, setForm] = useState<AgencyMarginRuleInsert>(emptyForm());

  const fmt = (v: number, type: MarginRuleType) =>
    type === "markup_flat" ? `$${v.toFixed(2)}` : `${v.toFixed(1)}%`;

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit   = (r: AgencyMarginRule) => {
    setEditing(r);
    setForm({ name: r.name, line_type: r.line_type, supplier_id: r.supplier_id,
              rule_type: r.rule_type, rule_value: r.rule_value,
              is_active: r.is_active, priority: r.priority, notes: r.notes });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editing) await updateRule.mutateAsync({ id: editing.id, ...form });
    else         await createRule.mutateAsync(form);
    setDialogOpen(false);
  };

  const saving = createRule.isPending || updateRule.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Margin Engine</h3>
          <p className="text-sm text-muted-foreground">
            Markup rules applied to booking line items. Higher priority rules win.
          </p>
        </div>
        <Button size="sm" className="ml-auto gap-2" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Markup Rules</CardTitle>
          <CardDescription>
            Supplier-specific rules override type rules at the same priority.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : rules.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No rules yet. Add one to set default markup behavior.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Applies To</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-center">Priority</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(rule => {
                  const supplier = activeSuppliers.find(s => s.id === rule.supplier_id);
                  return (
                    <TableRow key={rule.id} className={!rule.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span>{rule.line_type ? LINE_TYPE_LABELS[rule.line_type as MarginLineType] : "All types"}</span>
                          {supplier && <span className="text-xs text-muted-foreground">{supplier.name}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{RULE_TYPE_LABELS[rule.rule_type]}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{fmt(rule.rule_value, rule.rule_type)}</TableCell>
                      <TableCell className="text-center">{rule.priority}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={v => updateRule.mutate({ id: rule.id, is_active: v })}
                          className="scale-75"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => deleteRule.mutate(rule.id)} disabled={deleteRule.isPending}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Rule" : "New Markup Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Default Hotel Markup" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rule Type</Label>
                <Select value={form.rule_type} onValueChange={v => setForm({ ...form, rule_type: v as MarginRuleType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RULE_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input type="number" step="0.1" min="0" value={form.rule_value}
                  onChange={e => setForm({ ...form, rule_value: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Line Type</Label>
                <Select value={form.line_type ?? ""} onValueChange={v => setForm({ ...form, line_type: (v || null) as any })}>
                  <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    {LINE_TYPE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Supplier</Label>
                <Select value={form.supplier_id ?? "all"} onValueChange={v => setForm({ ...form, supplier_id: v === "all" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="All suppliers" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All suppliers</SelectItem>
                    {activeSuppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Priority (higher wins)</Label>
              <Input type="number" min="0" value={form.priority}
                onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
