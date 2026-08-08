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
import { Check, ChevronsUpDown, UserPlus, Compass, Users2 } from "lucide-react";
import { QuickAddClientForm } from "@/components/trips/QuickAddClientForm";

const TRIP_TYPES = [
  { value: "regular", label: "Regular Trip", icon: Compass },
  { value: "group", label: "Group Trip", icon: Users2 },
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
    num_travelers: "",
  });
  const [errors, setErrors] = useState<{ trip_name?: string; depart_date?: string; return_date?: string }>({});
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [inherited, setInherited] = useState<Record<string, any>>({});

  const clearError = (field: keyof typeof errors) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const selectedClient = clients.find((c) => c.id === formData.client_id);

  // Pre-fill sub-trip with parent trip info
  useEffect(() => {
    if (!open || !parentTripId) {
      if (!open) setInherited({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("id", parentTripId)
        .maybeSingle();
      if (cancelled || !data) return;
      const p = data as any;
      setFormData((prev) => ({
        ...prev,
        trip_name: prev.trip_name || p.trip_name || "",
        destination: prev.destination || p.destination || "",
        trip_type:
          p.trip_type && p.trip_type !== "group" ? p.trip_type : prev.trip_type,
        budget_range: prev.budget_range || p.budget_range || "",
        notes: prev.notes || p.notes || "",
        depart_date: prev.depart_date || p.depart_date || "",
        return_date: prev.return_date || p.return_date || "",
        num_travelers: prev.num_travelers || (p.num_travelers ? String(p.num_travelers) : ""),
      }));
      // Carry over the rest of the parent's trip setup
      const carry: Record<string, any> = {};
      const fields = [
        "ship_name",
        "cover_image_url",
        "currency",
        "pricing_visibility",
        "itinerary_style",
        "header_style",
        "tags",
        "allow_pdf_downloads",
        "budget_range",
        "trip_page_intro",
        "supplier_id",
        "agency_id",
        "trip_source",
      ];
      for (const f of fields) {
        if (p[f] !== undefined && p[f] !== null) carry[f] = p[f];
      }
      setInherited(carry);
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
      num_travelers: formData.num_travelers ? Number(formData.num_travelers) : undefined,
      ...(parentTripId ? { parent_trip_id: parentTripId, extra: inherited } : {}),
    } as any);

    if (result) {
      const tripId = (result as any).id;
      // Copy the parent group itinerary into the new sub-trip
      if (parentTripId && tripId) {
        try {
          const { data: parentItems } = await supabase
            .from("itinerary_items")
            .select("*")
            .eq("trip_id", parentTripId)
            .order("day_number", { ascending: true })
            .order("sort_order", { ascending: true });
          if (parentItems && parentItems.length > 0) {
            const inserts = parentItems.map((item: any, idx: number) => ({
              trip_id: tripId,
              user_id: (result as any).user_id,
              day_number: item.day_number,
              title: item.title,
              description: item.description,
              category: item.category,
              location: item.location,
              start_time: item.start_time,
              end_time: item.end_time,
              item_date: item.item_date,
              notes: item.notes,
              image_url: item.image_url ?? null,
              thumbnail_url: item.thumbnail_url ?? null,
              gallery_urls: item.gallery_urls ?? [],
              sort_order: item.sort_order ?? idx,
            }));
            await supabase.from("itinerary_items").insert(inserts as any);
          }
        } catch (err) {
          console.error("Failed to copy parent itinerary:", err);
        }
      }
      setFormData({
        trip_type: "regular",
        trip_name: "",
        destination: "",
        notes: "",
        client_id: "",
        budget_range: "",
        depart_date: "",
        return_date: "",
        num_travelers: "",
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
      <DialogContent className="max-w-[600px] max-h-[92vh] overflow-y-auto rounded-[14px] p-0 shadow-lg gap-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4 space-y-0.5">
          <DialogTitle className="text-[16.5px] font-semibold">Create new trip</DialogTitle>
          <DialogDescription className="text-[12.5px] text-muted-foreground">
            Set the trip up now — you can refine the itinerary in the next step.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-[18px] px-5 py-4">
          {/* Trip type — chip grid */}
          <div className="space-y-2">
            <Label className="text-[12.5px]">Trip type</Label>
            <div className="grid grid-cols-2 gap-2">
              {TRIP_TYPES.map((type) => {
                const selected = formData.trip_type === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, trip_type: type.value })}
                    className={cn(
                      "flex items-center gap-2 rounded-[9px] border-[1.5px] px-[10px] py-[9px] text-left text-[12.5px] transition-colors",
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
            <p className="text-[11.5px] text-muted-foreground">
              Cruise, lodging, or all-inclusive details are set on the trip after creation.
            </p>
          </div>

          {/* Trip name */}
          <div className="space-y-2">
            <Label htmlFor="trip_name" className="text-[12.5px]">
              Trip name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="trip_name"
              value={formData.trip_name}
              onChange={(e) => {
                setFormData({ ...formData, trip_name: e.target.value });
                clearError("trip_name");
              }}
              placeholder="e.g. Smith Family Vacation 2027"
              className={cn("h-10 text-[13.5px]", errors.trip_name && "border-destructive focus-visible:ring-destructive")}
            />
            <p className="min-h-[15px] text-[11.5px] text-destructive">{errors.trip_name}</p>
          </div>

          {/* Client Selector — searchable */}
          <div className="space-y-2">
            <Label className="text-[12.5px]">Client</Label>
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
                    className="h-10 w-full justify-between font-normal text-[13.5px]"
                  >
                    <span className={cn("truncate", !selectedClient && "text-muted-foreground")}>
                      {clientsLoading
                        ? "Loading clients..."
                        : selectedClient
                          ? selectedClient.name
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
                          <div className="flex flex-col">
                            <span className="text-[13.5px] font-medium">No client yet</span>
                            <span className="text-[11.5px] text-muted-foreground">Attach one later</span>
                          </div>
                        </CommandItem>
                        {clients.map((client) => {
                          const tier = (client as any).membership_tier as string | null | undefined;
                          const sinceYear = client.created_at
                            ? new Date(client.created_at).getFullYear()
                            : null;
                          const tierLabel = tier
                            ? tier.charAt(0).toUpperCase() + tier.slice(1)
                            : null;
                          const meta = [tierLabel, sinceYear ? `since ${sinceYear}` : null]
                            .filter(Boolean)
                            .join(" · ");
                          return (
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
                                "mr-2 h-4 w-4 text-accent",
                                formData.client_id === client.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="text-[13.5px] font-medium">{client.name}</span>
                              {meta ? (
                                <span className="text-[11.5px] text-muted-foreground">{meta}</span>
                              ) : client.email ? (
                                <span className="text-[11.5px] text-muted-foreground">{client.email}</span>
                              ) : null}
                            </div>
                          </CommandItem>
                          );
                        })}
                      </CommandGroup>
                      <CommandGroup>
                        <CommandItem
                          value="__add_new__"
                          onSelect={() => {
                            setClientPickerOpen(false);
                            setQuickAddOpen(true);
                          }}
                          className="text-accent"
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          <span className="font-medium">Add new client</span>
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination" className="text-[12.5px]">Destination</Label>
            <Input
              id="destination"
              value={formData.destination}
              onChange={(e) =>
                setFormData({ ...formData, destination: e.target.value })
              }
              placeholder="e.g. Amalfi Coast, Italy"
              className="h-10 text-[13.5px]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="depart_date" className="text-[12.5px]">
                Departure <span className="text-destructive">*</span>
              </Label>
              <Input
                id="depart_date"
                type="date"
                value={formData.depart_date}
                onChange={(e) => {
                  setFormData({ ...formData, depart_date: e.target.value });
                  clearError("depart_date");
                  clearError("return_date");
                }}
                className={cn("h-10 text-[13.5px]", errors.depart_date && "border-destructive focus-visible:ring-destructive")}
              />
              <p className="min-h-[15px] text-[11.5px] text-destructive">{errors.depart_date}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="return_date" className="text-[12.5px]">Return</Label>
              <Input
                id="return_date"
                type="date"
                value={formData.return_date}
                onChange={(e) => {
                  setFormData({ ...formData, return_date: e.target.value });
                  clearError("return_date");
                }}
                className={cn("h-10 text-[13.5px]", errors.return_date && "border-destructive focus-visible:ring-destructive")}
              />
              <p className="min-h-[15px] text-[11.5px] text-destructive">{errors.return_date}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="num_travelers" className="text-[12.5px]">Guests</Label>
              <Input
                id="num_travelers"
                type="number"
                min={1}
                inputMode="numeric"
                value={formData.num_travelers}
                onChange={(e) => setFormData({ ...formData, num_travelers: e.target.value })}
                placeholder="2"
                className="h-10 text-[13.5px] [font-variant-numeric:tabular-nums]"
              />
              <p className="min-h-[15px]" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget_range" className="text-[12.5px]">Estimated budget</Label>
            <Select
              value={formData.budget_range}
              onValueChange={(value) =>
                setFormData({ ...formData, budget_range: value === "none" ? "" : value })
              }
            >
              <SelectTrigger className="h-10 text-[13.5px]">
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
            <Label htmlFor="notes" className="text-[12.5px]">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Preferences, occasion, anything the itinerary should respect…"
              rows={3}
              className="text-[13.5px]"
            />
          </div>
        </form>

        <DialogFooter className="sticky bottom-0 z-10 justify-end gap-2 border-t border-border bg-card px-5 py-3 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[13px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={creating || !formData.trip_name}
            onClick={handleSubmit as any}
            className="text-[13px]"
          >
            {creating ? "Creating..." : "Create trip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
