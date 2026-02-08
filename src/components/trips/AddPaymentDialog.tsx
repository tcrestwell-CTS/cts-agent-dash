import { useState } from "react";
import {
  Dialog,
  DialogContent,
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
import { useTripPayments } from "@/hooks/useTripPayments";
import { TripBooking } from "@/hooks/useTrips";
import { Loader2 } from "lucide-react";

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  bookings: TripBooking[];
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  tripId,
  bookings,
}: AddPaymentDialogProps) {
  const { createPayment, creating } = useTripPayments(tripId);
  const [formData, setFormData] = useState({
    booking_id: "none",
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    due_date: "",
    payment_type: "payment",
    payment_method: "none",
    status: "pending",
    details: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      return;
    }

    const result = await createPayment({
      trip_id: tripId,
      booking_id: formData.booking_id === "none" ? null : formData.booking_id,
      amount: parseFloat(formData.amount),
      payment_date: formData.payment_date,
      due_date: formData.due_date || null,
      payment_type: formData.payment_type,
      payment_method: formData.payment_method === "none" ? null : formData.payment_method,
      status: formData.status,
      details: formData.details || null,
      notes: formData.notes || null,
    });

    if (result) {
      setFormData({
        booking_id: "none",
        amount: "",
        payment_date: new Date().toISOString().split("T")[0],
        due_date: "",
        payment_type: "payment",
        payment_method: "none",
        status: "pending",
        details: "",
        notes: "",
      });
      onOpenChange(false);
    }
  };

  const getBookingLabel = (booking: TripBooking) => {
    const supplier = booking.suppliers?.name || "";
    const destination = booking.destination || "";
    const tripName = booking.trip_name || "";
    return tripName || `${supplier} - ${destination}`.trim() || booking.booking_reference;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="booking_id">Link to Booking (Optional)</Label>
            <Select
              value={formData.booking_id}
              onValueChange={(value) => setFormData({ ...formData, booking_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a booking" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific booking</SelectItem>
                {bookings.map((booking) => (
                  <SelectItem key={booking.id} value={booking.id}>
                    {getBookingLabel(booking)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="authorized">Authorized</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment_type">Payment Type</Label>
              <Select
                value={formData.payment_type}
                onValueChange={(value) => setFormData({ ...formData, payment_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="final_balance">Final Balance</SelectItem>
                  <SelectItem value="authorization">Authorization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Details</Label>
            <Input
              id="details"
              placeholder="e.g., Authorized by John on Visa ending in 4054"
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !formData.amount}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
