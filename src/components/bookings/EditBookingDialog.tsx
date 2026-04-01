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
}

export function EditBookingDialog({
  booking, open, onOpenChange, onSubmit,
}: EditBookingDialogProps) {
  const { suppliers } = useSuppliers();
  const { user } = useAuth();
  const { activeRules } = useAgencyMarginRules();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("financials");

  const [formData, setFormData] = useState({
    total_price: 0, gross_sales: 0, supplier_payout: 0,
    supplier_id: "", commission_estimate: 0,
  });

  const { lines: dbLines, isLoading: linesLoading } = useBookingMarginLines(
    open ? booking?.id : undefined
  );
  const [localLines, setLocalLines] = useState<LocalMarginLine[]>([]);

  useEffect(() => {
    if (booking) {
      setFormData({
        total_price:         booking.total_price || 0,
        gross_sales:         booking.gross_sales || booking.total_price || 0,
        supplier_payout:     booking.supplier_payout || 0,
        supplier_id:         booking.supplier_id || "",
        commission_estimate: booking.commission_estimate || 0,
      });
    }
  }, [booking]);

  const dbLinesJson = JSON.stringify(dbLines.map(l => l.id));
  useEffect(() => {
    if (!linesLoading && dbLines.length > 0) {
      const real = dbLines.filter(l => l.source !== "synthetic");
      setLocalLines(real.length > 0 ? real.map(fromDbLine) : []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbLinesJson, linesLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !user) return;
    setSaving(true);
    try {
      const hasManualLines = localLines.length > 0;

      // When line items exist, derive supplier_payout and gross_sales from them
      let derivedSupplierPayout = formData.supplier_payout;
      let derivedGrossSales = formData.gross_sales;
      if (hasManualLines) {
        derivedSupplierPayout = localLines.reduce(
          (sum, l) => sum + (l.unit_cost * (l.quantity || 1)), 0
        );
        derivedGrossSales = localLines.reduce(
          (sum, l) => sum + (l.unit_sell * (l.quantity || 1)), 0
        );
      }

      const success = await onSubmit(booking.id, {
        total_price:         derivedGrossSales,
        gross_sales:         derivedGrossSales,
        supplier_payout:     derivedSupplierPayout,
        supplier_id:         formData.supplier_id || null,
        commission_estimate: formData.commission_estimate,
      });
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

        const inserts: BookingMarginLineInsert[] = localLines.map((l, i) => ({
          booking_id: booking.id, user_id: user.id,
          line_type: l.line_type, description: l.description,
          source: "manual" as const, quantity: l.quantity,
          unit_cost: l.unit_cost, unit_sell: l.unit_sell,
          is_pass_through: l.is_pass_through, sort_order: i,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                      setFormData({ ...formData, gross_sales: v, total_price: v });
                    }} />
                  <p className="text-xs text-muted-foreground mt-1">What client pays</p>
                </div>
                <div>
                  <Label htmlFor="supplier_payout">Supplier Cost ($)</Label>
                  <Input id="supplier_payout" type="number" step="0.01" min="0"
                    value={formData.supplier_payout}
                    onChange={e =>
                      setFormData({ ...formData, supplier_payout: parseFloat(e.target.value) || 0 })
                    } />
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
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
