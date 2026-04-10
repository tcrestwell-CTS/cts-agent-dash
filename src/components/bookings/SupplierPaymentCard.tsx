import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, CheckCircle2, Clock, DollarSign, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

interface SupplierPaymentCardProps {
  bookingId: string;
  supplierName?: string | null;
  supplierPayout: number;
  supplierPaidStatus: string;
  supplierPaidDate?: string | null;
  supplierPaidMethod?: string | null;
  supplierPaidReference?: string | null;
  supplierPaidAmount?: number;
  onUpdated: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  unpaid: { label: "Unpaid", className: "bg-amber-100 text-amber-700 border-amber-200" },
  partial: { label: "Partial", className: "bg-blue-100 text-blue-700 border-blue-200" },
  paid: { label: "Paid", className: "bg-green-100 text-green-700 border-green-200" },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function SupplierPaymentCard({
  bookingId,
  supplierName,
  supplierPayout,
  supplierPaidStatus,
  supplierPaidDate,
  supplierPaidMethod,
  supplierPaidReference,
  supplierPaidAmount = 0,
  onUpdated,
}: SupplierPaymentCardProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    status: supplierPaidStatus || "unpaid",
    date: supplierPaidDate || new Date().toISOString().split("T")[0],
    method: supplierPaidMethod || "",
    reference: supplierPaidReference || "",
    amount: supplierPaidAmount || supplierPayout || 0,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          supplier_paid_status: formData.status,
          supplier_paid_date: formData.date || null,
          supplier_paid_method: formData.method || null,
          supplier_paid_reference: formData.reference || null,
          supplier_paid_amount: formData.amount,
        })
        .eq("id", bookingId);

      if (error) throw error;
      toast.success("Supplier payment updated");
      setShowDialog(false);
      onUpdated();
    } catch (err: any) {
      toast.error("Failed to update: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const currentStatus = statusConfig[supplierPaidStatus] || statusConfig.unpaid;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Supplier Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant="outline" className={currentStatus.className}>
              {supplierPaidStatus === "paid" ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : (
                <Clock className="h-3 w-3 mr-1" />
              )}
              {currentStatus.label}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Supplier</span>
            <span className="text-sm font-medium">{supplierName || "—"}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Amount Due</span>
            <span className="text-sm font-medium">{formatCurrency(supplierPayout)}</span>
          </div>

          {supplierPaidStatus !== "unpaid" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount Paid</span>
                <span className="text-sm font-medium">{formatCurrency(supplierPaidAmount)}</span>
              </div>
              {supplierPaidDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Paid On</span>
                  <span className="text-sm">{format(parseLocalDate(supplierPaidDate), "MMM d, yyyy")}</span>
                </div>
              )}
              {supplierPaidMethod && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Method</span>
                  <span className="text-sm capitalize">{supplierPaidMethod}</span>
                </div>
              )}
              {supplierPaidReference && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Reference</span>
                  <span className="text-sm font-mono">{supplierPaidReference}</span>
                </div>
              )}
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={() => {
              setFormData({
                status: supplierPaidStatus || "unpaid",
                date: supplierPaidDate || new Date().toISOString().split("T")[0],
                method: supplierPaidMethod || "",
                reference: supplierPaidReference || "",
                amount: supplierPaidAmount || supplierPayout || 0,
              });
              setShowDialog(true);
            }}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            {supplierPaidStatus === "paid" ? "Update Payment" : "Record Payment"}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record Supplier Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Track payment to {supplierName || "supplier"} for this booking.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid in Full</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount Paid ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Date Paid</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={formData.method || "none"} onValueChange={(v) => setFormData((p) => ({ ...p, method: v === "none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="virtual_card">Virtual Card</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="ach">ACH / Wire</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reference / Confirmation #</Label>
              <Input
                placeholder="e.g. transaction ID or check number"
                value={formData.reference}
                onChange={(e) => setFormData((p) => ({ ...p, reference: e.target.value }))}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
