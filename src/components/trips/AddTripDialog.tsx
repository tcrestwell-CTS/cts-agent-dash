import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { formatLocalDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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
import { useTrips } from "@/hooks/useTrips";
import { useClients } from "@/hooks/useClients";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, UserPlus, Compass, Users2, Heart, Home, Gem, Ship, Mountain, Briefcase } from "lucide-react";
import { QuickAddClientForm } from "@/components/trips/QuickAddClientForm";

const TRIP_TYPES = [
  { value: "regular", label: "Regular Trip", icon: Compass },
  { value: "group", label: "Group Trip", icon: Users2 },
  { value: "honeymoon", label: "Honeymoon", icon: Heart },
  { value: "family", label: "Family Vacation", icon: Home },
  { value: "luxury", label: "Luxury", icon: Gem },
  { value: "cruise", label: "Cruise", icon: Ship },
  { value: "adventure", label: "Adventure", icon: Mountain },
  { value: "corporate", label: "Corporate / Business", icon: Briefcase },
];

interface AddTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTripCreated?: () => void;
  parentTripId?: string;
}

export function AddTripDialog({ open, onOpenChange, onTripCreated, parentTripId }: AddTripDialogProps) {
  const { createTrip, creating } = useTrips();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    trip_type: "regular",
    trip_name: "",
    destination: "",
    notes: "",
    client_id: "",
    budget_range: "",
    depart_date: "",
    return_date: "",
  });
  const [errors, setErrors] = useState<{ trip_name?: string; depart_date?: string; return_date?: string }>({});
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const clearError = (field: keyof typeof errors) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const selectedClient = clients.find((c) => c.id === formData.client_id);

  // Pre-fill sub-trip with parent trip info
  useEffect(() => {
    if (!open || !parentTripId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("trips")
        .select("trip_name, destination, trip_type, budget_range")
        .eq("id", parentTripId)
        .maybeSingle();
      if (cancelled || !data) return;
      setFormData((prev) => ({
        ...prev,
        trip_name: prev.trip_name || data.trip_name || "",
        destination: prev.destination || data.destination || "",
        trip_type:
          data.trip_type && data.trip_type !== "group" ? data.trip_type : prev.trip_type,
        budget_range: prev.budget_range || data.budget_range || "",
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, parentTripId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: typeof errors = {};
    if (!formData.trip_name.trim()) nextErrors.trip_name = "Trip name is required";
    if (!formData.depart_date) nextErrors.depart_date = "Departure date is required";
    if (formData.depart_date && formData.return_date) {
      if (differenceInCalendarDays(parseISO(formData.return_date), parseISO(formData.depart_date)) <= 0) {
        nextErrors.return_date = "Return must be after departure";
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const returnDate = formData.return_date || formatLocalDate(addDays(parseISO(formData.depart_date), 7));

    const result = await createTrip({
      ...formData,
      client_id: formData.client_id || undefined,
      depart_date: formData.depart_date,
      return_date: returnDate,
      ...(parentTripId ? { parent_trip_id: parentTripId } : {}),
    } as any);

    if (result) {
      const tripId = (result as any).id;
      setFormData({
        trip_type: "regular",
        trip_name: "",
        destination: "",
        notes: "",
        client_id: "",
        budget_range: "",
        depart_date: "",
        return_date: "",
      });
      setErrors({});
      onOpenChange(false);
      onTripCreated?.();
      if (!parentTripId && tripId) {
        const ref = (result as any).trip_name || formData.trip_name;
        toast.success(`Trip "${ref}" created — start building the itinerary`);
        navigate(`/trips/${tripId}/itinerary`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Trip</DialogTitle>
          <DialogDescription>
            Create a trip to organize bookings for your client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trip type — chip grid */}
          <div className="space-y-2">
            <Label>Trip Type</Label>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(126px, 1fr))" }}>
              {TRIP_TYPES.map((type) => {
                const selected = formData.trip_type === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, trip_type: type.value })}
                    className={cn(
                      "flex items-center gap-2 rounded-[9px] border px-2.5 py-2 text-left text-[13px] transition-colors",
                      selected
                        ? "border-accent bg-tint font-semibold text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <type.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Client Selector — searchable */}
          <div className="space-y-2">
            <Label>Client</Label>
            {quickAddOpen ? (
              <QuickAddClientForm
                onClientCreated={(id) => {
                  setFormData({ ...formData, client_id: id });
                  setQuickAddOpen(false);
                }}
                onCancel={() => setQuickAddOpen(false)}
              />
            ) : (
              <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn("truncate", !selectedClient && "text-muted-foreground")}>
                      {clientsLoading
                        ? "Loading clients..."
                        : selectedClient
                          ? `${selectedClient.name}${selectedClient.email ? ` (${selectedClient.email})` : ""}`
                          : "Search for a client (optional)"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      if (!search) return 1;
                      return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Search by name or email..." />
                    <CommandList>
                      <CommandEmpty>
                        <div className="py-2 text-sm text-muted-foreground">
                          No clients found.
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__none__"
                          onSelect={() => {
                            setFormData({ ...formData, client_id: "" });
                            setClientPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !formData.client_id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          No client yet
                        </CommandItem>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={`${client.name} ${client.email ?? ""} ${client.phone ?? ""}`}
                            onSelect={() => {
                              setFormData({ ...formData, client_id: client.id });
                              setClientPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.client_id === client.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{client.name}</span>
                              {client.email && (
                                <span className="text-xs text-muted-foreground">
                                  {client.email}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup>
                        <CommandItem
                          value="__add_new__"
                          onSelect={() => {
                            setClientPickerOpen(false);
                            setQuickAddOpen(true);
                          }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add new client
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip_name">Trip Name *</Label>
            <Input
              id="trip_name"
              value={formData.trip_name}
              onChange={(e) => {
                setFormData({ ...formData, trip_name: e.target.value });
                clearError("trip_name");
              }}
              placeholder="e.g., Smith Family Vacation 2026"
              className={cn(errors.trip_name && "border-destructive")}
            />
            <p className="min-h-[15px] text-[12px] text-destructive">{errors.trip_name}</p>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="depart_date">Departure *</Label>
              <Input
                id="depart_date"
                type="date"
                value={formData.depart_date}
                onChange={(e) => {
                  setFormData({ ...formData, depart_date: e.target.value });
                  clearError("depart_date");
                  clearError("return_date");
                }}
                className={cn(errors.depart_date && "border-destructive")}
              />
              <p className="min-h-[15px] text-[12px] text-destructive">{errors.depart_date}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="return_date">Return</Label>
              <Input
                id="return_date"
                type="date"
                value={formData.return_date}
                onChange={(e) => {
                  setFormData({ ...formData, return_date: e.target.value });
                  clearError("return_date");
                }}
                className={cn(errors.return_date && "border-destructive")}
              />
              <p className="min-h-[15px] text-[12px] text-destructive">{errors.return_date}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget_range">Estimated Budget</Label>
            <Select
              value={formData.budget_range}
              onValueChange={(value) =>
                setFormData({ ...formData, budget_range: value === "none" ? "" : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select budget range (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                <SelectItem value="under_5k">Under $5,000</SelectItem>
                <SelectItem value="5k_10k">$5,000 – $10,000</SelectItem>
                <SelectItem value="10k_25k">$10,000 – $25,000</SelectItem>
                <SelectItem value="25k_50k">$25,000 – $50,000</SelectItem>
                <SelectItem value="50k_100k">$50,000 – $100,000</SelectItem>
                <SelectItem value="over_100k">$100,000+</SelectItem>
              </SelectContent>
            </Select>
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
