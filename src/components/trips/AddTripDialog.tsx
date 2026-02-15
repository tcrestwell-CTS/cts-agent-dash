import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useTrips } from "@/hooks/useTrips";
import { DateRange } from "react-day-picker";

interface AddTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTripCreated?: () => void;
  parentTripId?: string;
}

export function AddTripDialog({ open, onOpenChange, onTripCreated, parentTripId }: AddTripDialogProps) {
  const { createTrip, creating } = useTrips();

  const [formData, setFormData] = useState({
    trip_type: "regular",
    trip_name: "",
    destination: "",
    notes: "",
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.trip_name) {
      return;
    }

    const result = await createTrip({
      ...formData,
      depart_date: dateRange?.from?.toISOString().split("T")[0],
      return_date: dateRange?.to?.toISOString().split("T")[0],
      ...(parentTripId ? { parent_trip_id: parentTripId } : {}),
    } as any);

    if (result) {
      setFormData({
        trip_type: "regular",
        trip_name: "",
        destination: "",
        notes: "",
      });
      setDateRange(undefined);
      onOpenChange(false);
      onTripCreated?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Trip</DialogTitle>
          <DialogDescription>
            Create a trip to organize bookings for your client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip_type">Trip Type *</Label>
            <Select
              value={formData.trip_type}
              onValueChange={(value) =>
                setFormData({ ...formData, trip_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trip type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular Trip</SelectItem>
                <SelectItem value="group">Group Trip</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip_name">Trip Name *</Label>
            <Input
              id="trip_name"
              value={formData.trip_name}
              onChange={(e) =>
                setFormData({ ...formData, trip_name: e.target.value })
              }
              placeholder="e.g., Smith Family Vacation 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              value={formData.destination}
              onChange={(e) =>
                setFormData({ ...formData, destination: e.target.value })
              }
              placeholder="e.g., New York, Hawaii, Europe"
            />
          </div>

          <div className="space-y-2">
            <Label>Trip Dates</Label>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any additional notes about this trip..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating || !formData.trip_name}
            >
              {creating ? "Creating..." : "Create Trip"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
