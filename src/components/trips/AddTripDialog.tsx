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
import { useClients } from "@/hooks/useClients";
import { DateRange } from "react-day-picker";
import { Plus } from "lucide-react";
import { QuickAddClientForm } from "./QuickAddClientForm";

interface AddTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTripDialog({ open, onOpenChange }: AddTripDialogProps) {
  const { createTrip, creating } = useTrips();
  const { data: clients = [] } = useClients();

  const [formData, setFormData] = useState({
    client_id: "",
    trip_name: "",
    destination: "",
    trip_type: "regular",
    notes: "",
    trip_page_url: "",
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showAddClient, setShowAddClient] = useState(false);

  const handleClientCreated = (clientId: string) => {
    setFormData({ ...formData, client_id: clientId });
    setShowAddClient(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client_id || !formData.trip_name) {
      return;
    }

    const result = await createTrip({
      ...formData,
      depart_date: dateRange?.from?.toISOString().split("T")[0],
      return_date: dateRange?.to?.toISOString().split("T")[0],
    });

    if (result) {
      setFormData({
        client_id: "",
        trip_name: "",
        destination: "",
        trip_type: "regular",
        notes: "",
        trip_page_url: "",
      });
      setDateRange(undefined);
      onOpenChange(false);
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

        {showAddClient ? (
          <QuickAddClientForm
            onClientCreated={handleClientCreated}
            onCancel={() => setShowAddClient(false)}
          />
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <div className="flex gap-2">
              <Select
                value={formData.client_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, client_id: value })
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowAddClient(true)}
                title="Add new client"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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
            <Label htmlFor="trip_type">Trip Type</Label>
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
                <SelectItem value="honeymoon">Honeymoon</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="cruise">Cruise</SelectItem>
                <SelectItem value="destination_wedding">
                  Destination Wedding
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip_page_url">Trip Page URL (Optional)</Label>
            <Input
              id="trip_page_url"
              type="url"
              value={formData.trip_page_url}
              onChange={(e) =>
                setFormData({ ...formData, trip_page_url: e.target.value })
              }
              placeholder="https://..."
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
              disabled={creating || !formData.client_id || !formData.trip_name}
            >
              {creating ? "Creating..." : "Create Trip"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
