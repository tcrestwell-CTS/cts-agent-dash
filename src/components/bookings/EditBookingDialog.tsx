import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Booking, UpdateBookingData } from "@/hooks/useBookings";
import { SupplierManagement } from "@/components/suppliers/SupplierManagement";

interface EditBookingDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (bookingId: string, data: UpdateBookingData) => Promise<boolean>;
}

export function EditBookingDialog({
  booking,
  open,
  onOpenChange,
  onSubmit,
}: EditBookingDialogProps) {
  const [formData, setFormData] = useState({
    total_price: 0,
    supplier_id: "",
    commission_estimate: 0,
  });

  useEffect(() => {
    if (booking) {
      setFormData({
        total_price: booking.total_price || 0,
        supplier_id: booking.supplier_id || "",
        commission_estimate: booking.commission_estimate || 0,
      });
    }
  }, [booking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    const success = await onSubmit(booking.id, {
      total_price: formData.total_price,
      supplier_id: formData.supplier_id || null,
      commission_estimate: formData.commission_estimate,
    });
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
          <DialogDescription>
            {booking?.confirmation_number}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="total_price">Total Price</Label>
            <Input
              id="total_price"
              type="number"
              step="0.01"
              value={formData.total_price}
              onChange={(e) => setFormData({ ...formData, total_price: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div>
            <Label htmlFor="commission_estimate">Commission Estimate</Label>
            <Input
              id="commission_estimate"
              type="number"
              step="0.01"
              value={formData.commission_estimate}
              onChange={(e) => setFormData({ ...formData, commission_estimate: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div>
            <Label>Supplier</Label>
            <SupplierManagement
              selectedSupplierId={formData.supplier_id || undefined}
              onSelect={(id) => setFormData({ ...formData, supplier_id: id || "" })}
              variant="compact"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
