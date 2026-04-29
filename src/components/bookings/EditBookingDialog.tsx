import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Booking, UpdateBookingData,
  recalculateMargin, useBookingMarginLines,
} from "@/hooks/useBookings";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  MarginLinesEditor, LocalMarginLine,
  createEmptyLine, fromDbLine,
} from "@/components/bookings/MarginLinesEditor";
import type { BookingMarginLineInsert } from "@/types/margin";
import { useAgencyMarginRules } from "@/hooks/useAgencyMarginRules";

interface EditBookingDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (bookingId: string, data: UpdateBookingData) => Promise<boolean>;
  onSaved?: () => void | Promise<void>;
}

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const getLineTotals = (lines: LocalMarginLine[]) => {
  return lines.reduce(
    (totals, line) => ({
      grossSales: roundCurrency(totals.grossSales + line.unit_sell * (line.quantity || 1)),
      supplierPayout: roundCurrency(totals.supplierPayout + line.unit_cost * (line.quantity || 1)),
    }),
    { grossSales: 0, supplierPayout: 0 },
  );
};

const withPreviewFields = (line: LocalMarginLine): LocalMarginLine => {
  const quantity = line.quantity || 1;
  const totalCost = roundCurrency(line.unit_cost * quantity);
  const totalSell = roundCurrency(line.unit_sell * quantity);

  return {
    ...line,
    _preview_total_cost: totalCost,
    _preview_total_sell: totalSell,
    _preview_margin: line.is_pass_through ? 0 : roundCurrency(totalSell - totalCost),
  };
};

const syncManualLinesToSummary = (
  lines: LocalMarginLine[],
  targetGrossSales: number,
  targetSupplierPayout: number,
) => {
  if (lines.length === 0) return lines;

  const { grossSales: currentGrossSales, supplierPayout: currentSupplierPayout } = getLineTotals(lines);
  const grossDelta = roundCurrency(targetGrossSales - currentGrossSales);
  const supplierDelta = roundCurrency(targetSupplierPayout - currentSupplierPayout);

  if (Math.abs(grossDelta) < 0.005 && Math.abs(supplierDelta) < 0.005) {
    return lines.map(withPreviewFields);
  }

  const primaryLineIndex = lines.reduce((bestIndex, line, index) => {
    const bestLine = lines[bestIndex];
    const linePriority = line.is_pass_through ? 0 : 1;
    const bestPriority = bestLine.is_pass_through ? 0 : 1;
    const lineWeight = roundCurrency((line.unit_sell + line.unit_cost) * (line.quantity || 1));
    const bestWeight = roundCurrency((bestLine.unit_sell + bestLine.unit_cost) * (bestLine.quantity || 1));

    if (linePriority > bestPriority) return index;
    if (linePriority === bestPriority && lineWeight > bestWeight) return index;
    return bestIndex;
  }, 0);

  const primaryLine = lines[primaryLineIndex];
  const quantity = primaryLine.quantity || 1;
  const nextUnitSell = roundCurrency(primaryLine.unit_sell + grossDelta / quantity);
  const nextUnitCost = roundCurrency(primaryLine.unit_cost + supplierDelta / quantity);

  if (nextUnitSell < 0 || nextUnitCost < 0) {
    return null;
  }

  return lines.map((line, index) =>
    index === primaryLineIndex
      ? withPreviewFields({ ...line, unit_sell: nextUnitSell, unit_cost: nextUnitCost })
      : withPreviewFields(line),
  );
};

export function EditBookingDialog({
  booking, open, onOpenChange, onSubmit, onSaved,
}: EditBookingDialogProps) {
  const { suppliers } = useSuppliers();
  const { user } = useAuth();
  const { activeRules } = useAgencyMarginRules();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("financials");

  const [formData, setFormData] = useState({
    total_price: 0, gross_sales: 0, supplier_payout: 0,
    supplier_id: "", commission_estimate: 0,
    supplier_confirmation_number: "",
  });

  const { lines: dbLines, isLoading: linesLoading, invalidate: invalidateMarginLines } = useBookingMarginLines(
    open ? booking?.id : undefined
  );
  const [localLines, setLocalLines] = useState<LocalMarginLine[]>([]);
  const [financialsDirty, setFinancialsDirty] = useState(false);
  const [marginValid, setMarginValid] = useState(true);

  useEffect(() => {
    if (booking) {
      setFormData({
        total_price:         booking.total_price || 0,
        gross_sales:         booking.gross_sales || booking.total_price || 0,
        supplier_payout:     booking.supplier_payout || 0,
        supplier_id:         booking.supplier_id || "",
        commission_estimate: booking.commission_estimate || 0,
        supplier_confirmation_number: (booking as any).supplier_confirmation_number || "",
      });
    }
    setLocalLines([]);
    setFinancialsDirty(false);
  }, [booking]);

  const dbLinesJson = JSON.stringify(dbLines.map((line) => ({
    id: line.id,
    source: line.source,
    quantity: line.quantity,
    unit_cost: line.unit_cost,
    unit_sell: line.unit_sell,
    is_pass_through: line.is_pass_through,
  })));
  useEffect(() => {
    if (linesLoading) return;

    const real = dbLines.filter(l => l.source !== "synthetic");
    const nextLines = real.map(fromDbLine);
    setLocalLines(nextLines);

    if (nextLines.length > 0 && !financialsDirty) {
      const totals = getLineTotals(nextLines);
      setFormData((prev) => ({
        ...prev,
        total_price: totals.grossSales,
        gross_sales: totals.grossSales,
        supplier_payout: totals.supplierPayout,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbLinesJson, linesLoading, financialsDirty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !user) return;
    if (!marginValid) {
      toast.error("Pass-through lines require at least one line with margin. Add a service fee or markup.");
      return;
    }
    setSaving(true);
    try {
      const hasManualLines = localLines.length > 0;
      let linesToPersist = localLines;

      if (hasManualLines && financialsDirty) {
        const syncedLines = syncManualLinesToSummary(
          localLines,
          formData.gross_sales,
          formData.supplier_payout,
        );

        if (!syncedLines) {
          toast.error("That total is lower than the existing line items. Update the line items directly.");
          return;
        }

        linesToPersist = syncedLines;
      }

      // When line items exist, derive supplier_payout and gross_sales from them
      let derivedSupplierPayout = formData.supplier_payout;
      let derivedGrossSales = formData.gross_sales;
      if (hasManualLines) {
        const totals = getLineTotals(linesToPersist);
        derivedSupplierPayout = totals.supplierPayout;
        derivedGrossSales = totals.grossSales;
      }

      const success = await onSubmit(booking.id, {
        total_price:         derivedGrossSales,
        gross_sales:         derivedGrossSales,
        supplier_payout:     derivedSupplierPayout,
        supplier_id:         formData.supplier_id || null,
        commission_estimate: formData.commission_estimate,
        supplier_confirmation_number: formData.supplier_confirmation_number || null,
      } as any);
      if (!success) return;

      if (hasManualLines) {
        const { error: deleteError } = await (supabase as any)
          .from("booking_margin_lines")
          .delete()
          .eq("booking_id", booking.id);

        if (deleteError) {
          console.error("[EditBooking] Failed to delete margin lines:", deleteError);
          toast.error("Failed to update line items — please try again.");
          return;
        }

        const inserts: BookingMarginLineInsert[] = linesToPersist.map((l, i) => ({
          booking_id: booking.id, user_id: user.id,
          line_type: l.line_type, description: l.description,
          source: "manual" as const, quantity: l.quantity,
          unit_cost: l.unit_cost, unit_sell: l.unit_sell,
          is_pass_through: l.is_pass_through, sort_order: i,
          deposit_amount: l.deposit_amount || 0,
          is_optional: l.is_optional || false,
          is_internal: (l as any).is_internal || false,
        }));

        const { error: insertError } = await (supabase as any).from("booking_margin_lines").insert(inserts);
        if (insertError) {
          console.error("[EditBooking] Failed to insert margin lines:", insertError);
          toast.error("Failed to save line items — margin not recalculated.");
          return;
        }
      }

      await recalculateMargin(
        booking.id, user.id,
        derivedGrossSales, derivedSupplierPayout,
        null,
        hasManualLines
      );

      await Promise.all([
        invalidateMarginLines(),
        Promise.resolve(onSaved?.()),
      ]);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const activeSuppliers = (suppliers || []).filter(s => s.is_active);
  const previewMargin = formData.gross_sales - formData.supplier_payout;
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
          <DialogDescription>{booking?.confirmation_number}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="financials">Financials</TabsTrigger>
              <TabsTrigger value="lines">Line Items</TabsTrigger>
            </TabsList>

            <TabsContent value="financials" className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gross_sales">Gross Sales ($)</Label>
                  <Input id="gross_sales" type="number" step="0.01" min="0"
                    value={formData.gross_sales}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0;
                      setFinancialsDirty(true);
                      setFormData({ ...formData, gross_sales: v, total_price: v });
                    }} />
                  <p className="text-xs text-muted-foreground mt-1">What client pays</p>
                </div>
                <div>
                  <Label htmlFor="supplier_payout">Supplier Cost ($)</Label>
                  <Input id="supplier_payout" type="number" step="0.01" min="0"
                    value={formData.supplier_payout}
                    onChange={e => {
                      setFinancialsDirty(true);
                      setFormData({ ...formData, supplier_payout: parseFloat(e.target.value) || 0 });
                    }} />
                  <p className="text-xs text-muted-foreground mt-1">What you pay supplier</p>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Margin</span>
                  <span className={`font-semibold ${previewMargin >= 0 ? "text-success" : "text-destructive"}`}>
                    {fmt(previewMargin)}
                    {formData.gross_sales > 0 && (
                      <span className="ml-1 font-normal text-xs opacity-70">
                        ({((previewMargin / formData.gross_sales) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-xs text-muted-foreground">
                  <span>You remit to supplier</span>
                  <span>{fmt(formData.supplier_payout)}</span>
                </div>
                {formData.supplier_payout === 0 && formData.gross_sales > 0 && (
                  <p className="text-xs text-amber-600">
                    ⚠ Supplier cost is $0 — update with Net Charges from your booking confirmation.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Supplier</Label>
                  <Select value={formData.supplier_id || "none"}
                    onValueChange={v => setFormData({ ...formData, supplier_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supplier</SelectItem>
                      {activeSuppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="supplier_confirmation_number">Supplier Conf #</Label>
                  <Input id="supplier_confirmation_number"
                    value={formData.supplier_confirmation_number || ""}
                    onChange={e => setFormData({ ...formData, supplier_confirmation_number: e.target.value })}
                    placeholder="SUP-12345"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="commission_estimate">Commission Estimate ($)</Label>
                <Input id="commission_estimate" type="number" step="0.01" min="0"
                  value={formData.commission_estimate}
                  onChange={e =>
                    setFormData({ ...formData, commission_estimate: parseFloat(e.target.value) || 0 })
                  } />
              </div>
            </TabsContent>

            <TabsContent value="lines" className="pt-2">
              {linesLoading ? (
                <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading line items...
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Add detailed line items. When saved, these replace the summary financials
                    as the source of truth for margin calculation.
                  </p>

                  {/* Quick-add common cruise add-ons */}
                  <div className="flex flex-wrap gap-2">
                    <p className="w-full text-xs font-medium text-muted-foreground">Quick add:</p>
                    {[
                      { label: "🍹 Drink Package",  type: "service_fee" as const, desc: "Beverage package" },
                      { label: "🛡️ Trip Insurance", type: "insurance"   as const, desc: "Travel protection" },
                      { label: "📶 Wi-Fi",           type: "service_fee" as const, desc: "Onboard internet" },
                      { label: "🚢 Shore Excursion", type: "excursion"   as const, desc: "Shore excursion" },
                      { label: "🍽️ Specialty Dining",type: "service_fee" as const, desc: "Specialty dining pkg" },
                    ].map(addon => (
                      <button
                        key={addon.label}
                        type="button"
                        className="text-xs px-2 py-1 rounded-md border border-border bg-muted/40 hover:bg-muted transition-colors"
                        onClick={() => {
                          const newLine = {
                            id: crypto.randomUUID(),
                            line_type: addon.type,
                            description: addon.desc,
                            source: "manual" as const,
                            quantity: 1,
                            unit_cost: 0,
                            unit_sell: 0,
                            is_pass_through: false,
                            sort_order: localLines.length,
                            _preview_total_cost: 0,
                            _preview_total_sell: 0,
                            _preview_margin: 0,
                          };
                          setLocalLines(prev => [...(prev.length > 0 ? prev : []), newLine]);
                        }}
                      >
                        {addon.label}
                      </button>
                    ))}
                  </div>

                  <MarginLinesEditor
                    lines={localLines.length > 0 ? localLines : [createEmptyLine(0)]}
                    onChange={setLocalLines}
                    rules={activeRules}
                    supplierId={formData.supplier_id || null}
                    onMarginValid={setMarginValid}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !marginValid}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
