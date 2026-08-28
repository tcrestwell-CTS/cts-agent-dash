import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MarkSupplierPaidButtonProps {
  paymentId: string;
  amount: number;
  supplierName?: string | null;
  /** Only render for paid client payments */
  paymentStatus: string;
  /** Hide when a Stripe virtual card already covers this payment */
  virtualCardId?: string | null;
  virtualCardStatus?: string | null;
  supplierPaidAt?: string | null;
  supplierPaymentMethod?: string | null;
  supplierPaymentRef?: string | null;
  onUpdated?: () => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const METHOD_LABELS: Record<string, string> = {
  agency_card: "Agency credit card",
  bank_transfer: "Bank transfer / ACH",
  check: "Check",
  supplier_portal: "Supplier portal",
  other: "Other",
};

/**
 * Workaround while Stripe Issuing is unavailable: lets an agent record that
 * the supplier was paid manually (agency card, bank transfer, etc.).
 */
export function MarkSupplierPaidButton({
  paymentId,
  amount,
  supplierName,
  paymentStatus,
  virtualCardId,
  virtualCardStatus,
  supplierPaidAt,
  supplierPaymentMethod,
  supplierPaymentRef,
  onUpdated,
}: MarkSupplierPaidButtonProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState<string>("agency_card");
  const [reference, setReference] = useState("");

  if (paymentStatus !== "paid") return null;

  const hasCard = !!virtualCardId && virtualCardStatus === "ready";
  if (hasCard) return null;

  // Already marked — show an informational badge
  if (supplierPaidAt) {
    const label = METHOD_LABELS[supplierPaymentMethod || ""] || supplierPaymentMethod || "Manual";
    return (
      <Badge
        variant="outline"
        className="text-[10px] border-success text-success whitespace-nowrap"
        title={`Supplier paid via ${label}${supplierPaymentRef ? ` — ref ${supplierPaymentRef}` : ""} on ${new Date(supplierPaidAt).toLocaleDateString()}`}
      >
        <Landmark className="h-3 w-3 mr-1" />
        Supplier paid{supplierPaymentRef ? ` · ${supplierPaymentRef}` : ""}
      </Badge>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("trip_payments")
        .update({
          supplier_paid_at: new Date().toISOString(),
          supplier_payment_method: method,
          supplier_payment_ref: reference.trim() || null,
        })
        .eq("id", paymentId);

      if (error) throw error;

      toast.success(
        `Supplier payment recorded — ${formatCurrency(amount)} via ${METHOD_LABELS[method]}.`
      );
      setOpen(false);
      onUpdated?.();
    } catch (err: any) {
      toast.error("Could not record supplier payment: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
        data-testid="button-mark-supplier-paid"
      >
        <Landmark className="h-3.5 w-3.5" />
        Mark Supplier Paid
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Record Manual Supplier Payment
            </DialogTitle>
            <DialogDescription>
              Confirm you paid{" "}
              {supplierName ? <strong>{supplierName}</strong> : "the supplier"}{" "}
              <strong>{formatCurrency(amount)}</strong> outside of Stripe Issuing
              (e.g. agency card or bank transfer).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-pay-method">Payment method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="supplier-pay-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-pay-ref">Confirmation / reference (optional)</Label>
              <Input
                id="supplier-pay-ref"
                placeholder="e.g. Supplier confirmation # or transaction ID"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-confirm-supplier-paid">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {saving ? "Saving…" : "Confirm Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
