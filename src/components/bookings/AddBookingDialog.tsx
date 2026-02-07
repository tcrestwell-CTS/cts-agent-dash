import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Mail, Users } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useCompanions } from "@/hooks/useCompanions";
import { useAddBookingTravelers } from "@/hooks/useBookingTravelers";
import { CreateBookingData } from "@/hooks/useBookings";
import { Booking } from "@/hooks/useBookings";

interface AddBookingDialogProps {
  onSubmit: (data: CreateBookingData) => Promise<Booking | null>;
  creating: boolean;
}

export function AddBookingDialog({ onSubmit, creating }: AddBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const addBookingTravelers = useAddBookingTravelers();
  
  const [formData, setFormData] = useState({
    client_id: "",
    destination: "",
    depart_date: "",
    return_date: "",
    travelers: 1,
    total_amount: 0,
    trip_name: "",
    notes: "",
    send_confirmation_email: true,
  });

  const [selectedCompanionIds, setSelectedCompanionIds] = useState<string[]>([]);

  // Fetch companions for the selected client
  const { data: companions = [], isLoading: companionsLoading } = useCompanions(
    formData.client_id || undefined
  );

  const [selectedClientEmail, setSelectedClientEmail] = useState<string | null>(null);

  // Update selected client email when client changes
  // Reset selected companions when client changes
  useEffect(() => {
    setSelectedCompanionIds([]);
  }, [formData.client_id]);

  useEffect(() => {
    if (formData.client_id) {
      const client = clients.find(c => c.id === formData.client_id);
      setSelectedClientEmail(client?.email || null);
    } else {
      setSelectedClientEmail(null);
    }
  }, [formData.client_id, clients]);

  const toggleCompanion = (companionId: string) => {
    setSelectedCompanionIds(prev =>
      prev.includes(companionId)
        ? prev.filter(id => id !== companionId)
        : [...prev, companionId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id || !formData.destination || !formData.depart_date || !formData.return_date) {
      return;
    }

    const result = await onSubmit(formData);
    if (result) {
      // Add selected companions as travelers
      if (selectedCompanionIds.length > 0) {
        await addBookingTravelers.mutateAsync({
          bookingId: result.id,
          companionIds: selectedCompanionIds,
        });
      }

      setOpen(false);
      setFormData({
        client_id: "",
        destination: "",
        depart_date: "",
        return_date: "",
        travelers: 1,
        total_amount: 0,
        trip_name: "",
        notes: "",
        send_confirmation_email: true,
      });
      setSelectedCompanionIds([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Booking</DialogTitle>
          <DialogDescription>
            Add a new travel booking for a client
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select
              value={formData.client_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={clientsLoading ? "Loading clients..." : "Select a client"} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} {client.email ? `(${client.email})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip_name">Trip Name</Label>
            <Input
              id="trip_name"
              value={formData.trip_name}
              onChange={(e) => setFormData(prev => ({ ...prev, trip_name: e.target.value }))}
              placeholder="e.g., European Adventure"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destination *</Label>
            <Input
              id="destination"
              value={formData.destination}
              onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
              placeholder="e.g., Paris, France"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="depart_date">Departure Date *</Label>
              <Input
                id="depart_date"
                type="date"
                value={formData.depart_date}
                onChange={(e) => setFormData(prev => ({ ...prev, depart_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return_date">Return Date *</Label>
              <Input
                id="return_date"
                type="date"
                value={formData.return_date}
                onChange={(e) => setFormData(prev => ({ ...prev, return_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="travelers">Travelers</Label>
              <Input
                id="travelers"
                type="number"
                min="1"
                value={formData.travelers}
                onChange={(e) => setFormData(prev => ({ ...prev, travelers: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_amount">Total Amount ($)</Label>
              <Input
                id="total_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.total_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, total_amount: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Travel Companions Selection */}
          {formData.client_id && companions.length > 0 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Travel Companions
              </Label>
              <p className="text-xs text-muted-foreground">
                Select companions who will be traveling on this trip
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
                {companionsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading companions...</p>
                ) : (
                  companions.map((companion) => (
                    <div key={companion.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`companion-${companion.id}`}
                        checked={selectedCompanionIds.includes(companion.id)}
                        onCheckedChange={() => toggleCompanion(companion.id)}
                      />
                      <label
                        htmlFor={`companion-${companion.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {companion.first_name} {companion.last_name}
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({companion.relationship})
                        </span>
                      </label>
                    </div>
                  ))
                )}
              </div>
              {selectedCompanionIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedCompanionIds.length} companion{selectedCompanionIds.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional booking notes..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Send Confirmation Email</p>
                <p className="text-xs text-muted-foreground">
                  {selectedClientEmail 
                    ? `Email will be sent to ${selectedClientEmail}`
                    : "Select a client with email to enable"}
                </p>
              </div>
            </div>
            <Switch
              checked={formData.send_confirmation_email && !!selectedClientEmail}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, send_confirmation_email: checked }))}
              disabled={!selectedClientEmail}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Booking
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
