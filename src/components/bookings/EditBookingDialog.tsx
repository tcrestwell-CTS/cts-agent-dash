import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Booking, UpdateBookingData } from "@/hooks/useBookings";
import { useSuppliers } from "@/hooks/useSuppliers";

interface EditBookingDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: UpdateBookingData) => Promise<boolean>;
  updating: boolean;
}

export function EditBookingDialog({
  booking,
  open,
  onOpenChange,
  onSubmit,
  updating,
}: EditBookingDialogProps) {
  const { activeSuppliers } = useSuppliers();
  const [formData, setFormData] = useState({
    destination: "",
    depart_date: "",
    return_date: "",
    travelers: 1,
    total_amount: 0,
    trip_name: "",
    notes: "",
    supplier_id: "",
  });

  // Populate form when booking changes
  useEffect(() => {
    if (booking) {
      setFormData({
        destination: booking.destination || "",
        depart_date: booking.depart_date || "",
        return_date: booking.return_date || "",
        travelers: booking.travelers || 1,
        total_amount: booking.total_amount || 0,
        trip_name: booking.trip_name || "",
        notes: booking.notes || "",
        supplier_id: booking.supplier_id || "",
      });
    }
  }, [booking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!booking || !formData.destination || !formData.depart_date || !formData.return_date) {
      return;
    }

    const success = await onSubmit(booking.id, {
      ...formData,
      supplier_id: formData.supplier_id || null,
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
            {booking?.booking_reference} • {booking?.clients?.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="edit_trip_name">Trip Name</Label>
            <Input
              id="edit_trip_name"
              value={formData.trip_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, trip_name: e.target.value }))}
              placeholder="e.g., European Adventure"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_supplier">Supplier</Label>
            <Select
              value={formData.supplier_id}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, supplier_id: value === "none" ? "" : value }))}
            >
              <SelectTrigger id="edit_supplier">
                <SelectValue placeholder="Select a supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Supplier</SelectItem>
                {activeSuppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_destination">Destination *</Label>
            <Input
              id="edit_destination"
              value={formData.destination}
              onChange={(e) => setFormData((prev) => ({ ...prev, destination: e.target.value }))}
              placeholder="e.g., Paris, France"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_depart_date">Departure Date *</Label>
              <Input
                id="edit_depart_date"
                type="date"
                value={formData.depart_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, depart_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_return_date">Return Date *</Label>
              <Input
                id="edit_return_date"
                type="date"
                value={formData.return_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, return_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_travelers">Travelers</Label>
              <Input
                id="edit_travelers"
                type="number"
                min="1"
                value={formData.travelers}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, travelers: parseInt(e.target.value) || 1 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_total_amount">Total Amount ($)</Label>
              <Input
                id="edit_total_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.total_amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, total_amount: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_notes">Notes</Label>
            <Textarea
              id="edit_notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional booking notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updating}>
              {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
