import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Mail,
  XCircle,
  CheckCheck,
  Link2,
} from "lucide-react";
import {
  getProviderMeta,
  getStatusBadgeClasses,
  getStatusLabel,
} from "@/lib/carRentalProviders";
import { cn } from "@/lib/utils";
import { CCAuthDialog } from "./CCAuthDialog";
import { CarRentalWorkflow } from "./CarRentalWorkflow";

interface Props {
  rentalId: string | null;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

type ClientLite = { id: string; name: string | null; email: string | null };
type TripLite = { id: string; trip_name: string | null; destination: string | null };

export function CarRentalDrawer({ rentalId, onOpenChange, onUpdated }: Props) {
  const open = !!rentalId;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [notesTimer, setNotesTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [ccAuthOpen, setCcAuthOpen] = useState(false);

  const { data: rental, refetch } = useQuery({
    queryKey: ["car-rental", rentalId],
    enabled: !!rentalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("car_rental_requests")
        .select("*")
        .eq("id", rentalId!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    setNotesDraft(rental?.agent_notes ?? "");
  }, [rental?.id]);

  // Linked client + trip lookups for autocomplete
  const [clientSearch, setClientSearch] = useState("");
  const { data: clientMatches = [] } = useQuery({
    queryKey: ["car-rental-clients", clientSearch],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("clients").select("id,name,email").limit(10);
      if (clientSearch.trim()) {
        q = q.or(
          `name.ilike.%${clientSearch}%,email.ilike.%${clientSearch}%`
        );
      }
      const { data } = await q;
      return (data || []) as ClientLite[];
    },
  });

  const { data: linkedClient } = useQuery({
    queryKey: ["car-rental-linked-client", rental?.client_id],
    enabled: !!rental?.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id,name,email")
        .eq("id", rental!.client_id)
        .maybeSingle();
      return (data || null) as ClientLite | null;
    },
  });

  const { data: tripChoices = [] } = useQuery({
    queryKey: ["car-rental-client-trips", rental?.client_id],
    enabled: !!rental?.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("trips")
        .select("id,trip_name,destination")
        .eq("client_id", rental!.client_id)
        .order("created_at", { ascending: false });
      return (data || []) as TripLite[];
    },
  });

  async function update(patch: Record<string, unknown>, label = "Saved") {
    if (!rentalId) return;
    setSaving(label);
    const { error } = await supabase
      .from("car_rental_requests")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", rentalId);
    setSaving(null);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    await refetch();
    qc.invalidateQueries({ queryKey: ["car-rentals"] });
    onUpdated?.();
    toast({ title: label });
  }

  function scheduleNotesSave(value: string) {
    setNotesDraft(value);
    if (notesTimer) clearTimeout(notesTimer);
    const t = setTimeout(() => update({ agent_notes: value }, "Notes saved"), 800);
    setNotesTimer(t);
  }

  const provMeta = useMemo(() => getProviderMeta(rental?.provider), [rental?.provider]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {!rental ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {rental.driver_name}
                <Badge variant="outline" className={cn("border", provMeta.classes)}>
                  {provMeta.name}
                </Badge>
                <Badge variant="outline" className={getStatusBadgeClasses(rental.status)}>
                  {getStatusLabel(rental.status)}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                Created {rental.created_at ? format(new Date(rental.created_at), "PPp") : "—"}
              </SheetDescription>
            </SheetHeader>

            {/* Actions bar */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => update({ status: "confirmed" }, "Marked confirmed")}>
                <CheckCheck className="h-4 w-4 mr-1" /> Mark Confirmed
              </Button>
              <Button size="sm" variant="outline" onClick={() => update({ status: "completed" }, "Marked completed")}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Completed
              </Button>
              <Button size="sm" variant="outline" onClick={() => update({ status: "cancelled" }, "Cancelled")}>
                <XCircle className="h-4 w-4 mr-1" /> Cancel Request
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast({ title: "Coming soon", description: "Confirmation email will be wired up in the next step." })}
              >
                <Mail className="h-4 w-4 mr-1" /> Send Confirmation
              </Button>
              {saving && (
                <span className="flex items-center text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" /> {saving}…
                </span>
              )}
            </div>

            {/* Section 1 — Trip Details */}
            <CarRentalWorkflow rental={rental} onChanged={async () => {
              await refetch();
              qc.invalidateQueries({ queryKey: ["car-rentals"] });
              onUpdated?.();
            }} />

            <Section title="Trip Details">
              <FieldGrid>
                <ReadField label="Trip Type" value={rental.trip_type} capitalize />
                <ReadField label="Vehicle Class" value={rental.vehicle_class} capitalize />
                <ReadField label="Provider" value={provMeta.name} />
                <ReadField label="Flight Number" value={rental.flight_number} />
                <ReadField label="Pickup Date" value={rental.pickup_date} />
                <ReadField label="Pickup Time" value={rental.pickup_time} />
                <ReadField label="Return Date" value={rental.return_date} />
                <ReadField label="Return Time" value={rental.return_time} />
                <ReadField label="Pickup Location" value={rental.pickup_location} full />
                <ReadField label="Drop-off Location" value={rental.dropoff_location || rental.pickup_location} full />
              </FieldGrid>
            </Section>

            {/* Section 2 — Driver */}
            <Section title="Driver">
              <FieldGrid>
                <ReadField label="Name"  value={rental.driver_name} />
                <ReadField label="Email" value={rental.driver_email} />
                <ReadField label="Phone" value={rental.driver_phone} />
                <ReadField label="Age Range" value={rental.driver_age_range} />
                <ReadField label="Additional Drivers" value={String(rental.additional_drivers ?? 0)} />
                <ReadField label="Driver Notes" value={rental.notes} full />
              </FieldGrid>
            </Section>

            {/* Section 3 — Provider Details */}
            <Section title="Provider Details">
              <FieldGrid>
                <EditField
                  label="Loyalty Number"
                  initial={rental.loyalty_number ?? ""}
                  onSave={(v) => update({ loyalty_number: v || null }, "Loyalty number saved")}
                />
                <EditField
                  label="Provider Booking Ref"
                  initial={rental.provider_booking_ref ?? ""}
                  onSave={(v) => update({ provider_booking_ref: v || null }, "Booking ref saved")}
                />
                <EditField
                  label="Confirmation Number"
                  initial={rental.confirmation_number ?? ""}
                  onSave={(v) => update({ confirmation_number: v || null }, "Confirmation saved")}
                />
                <EditField
                  label="Estimated Total ($)"
                  type="number"
                  initial={rental.estimated_total != null ? String(rental.estimated_total) : ""}
                  onSave={(v) =>
                    update(
                      { estimated_total: v === "" ? null : Number(v) },
                      "Estimated total saved"
                    )
                  }
                />
                <EditField
                  label="Actual Total ($)"
                  type="number"
                  initial={rental.actual_total != null ? String(rental.actual_total) : ""}
                  onSave={(v) =>
                    update(
                      { actual_total: v === "" ? null : Number(v) },
                      "Actual total saved"
                    )
                  }
                />
              </FieldGrid>
            </Section>

            {/* Section 4 — CC Authorization */}
            <Section title="CC Authorization">
              <FieldGrid>
                <ReadField label="Cardholder" value={rental.cc_auth_cardholder_name} />
                <ReadField label="Last Four" value={rental.cc_auth_last_four ? `•••• ${rental.cc_auth_last_four}` : null} />
                <ReadField
                  label="Expiry"
                  value={
                    rental.cc_auth_exp_month && rental.cc_auth_exp_year
                      ? `${rental.cc_auth_exp_month}/${String(rental.cc_auth_exp_year).slice(-2)}`
                      : null
                  }
                />
                <ReadField label="Billing ZIP" value={rental.cc_auth_billing_zip} />
                <ReadField label="Stripe PM ID" value={rental.cc_auth_stripe_pm_id} full />
              </FieldGrid>

              <div className="flex items-center justify-between gap-3 mt-3 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="cc-authorized"
                    checked={!!rental.cc_authorized}
                    onCheckedChange={(c) => {
                      const checked = !!c;
                      update(
                        {
                          cc_authorized: checked,
                          cc_authorized_at: checked ? new Date().toISOString() : null,
                        },
                        checked ? "CC marked authorized" : "CC auth cleared"
                      );
                    }}
                  />
                  <Label htmlFor="cc-authorized" className="cursor-pointer">
                    CC Authorized
                  </Label>
                  {rental.cc_authorized_at && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(rental.cc_authorized_at), "PPp")}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setCcAuthOpen(true)}
                >
                  <CreditCard className="h-4 w-4 mr-1" /> Run CC Auth
                </Button>
              </div>
            </Section>

            {/* Section 5 — CRM Linkage */}
            <Section title="CRM Linkage">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Linked Client</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        <Link2 className="h-4 w-4 mr-2" />
                        {linkedClient
                          ? `${linkedClient.name ?? "—"} (${linkedClient.email ?? "no email"})`
                          : "Search & link client…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search by name or email…"
                          value={clientSearch}
                          onValueChange={setClientSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No clients found.</CommandEmpty>
                          <CommandGroup>
                            {rental.client_id && (
                              <CommandItem
                                value="__unlink__"
                                onSelect={() => update({ client_id: null, trip_id: null }, "Unlinked client")}
                              >
                                <XCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                                Unlink client
                              </CommandItem>
                            )}
                            {clientMatches.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.id}
                                onSelect={() => update({ client_id: c.id, trip_id: null }, "Client linked")}
                              >
                                <div className="flex flex-col">
                                  <span>{c.name ?? "Unnamed"}</span>
                                  <span className="text-xs text-muted-foreground">{c.email}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Linked Trip</Label>
                  <Select
                    value={rental.trip_id ?? "__none__"}
                    onValueChange={(v) => update({ trip_id: v === "__none__" ? null : v }, "Trip linked")}
                    disabled={!rental.client_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={rental.client_id ? "Select trip…" : "Link a client first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No linked trip</SelectItem>
                      {tripChoices.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.trip_name || t.destination || t.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <EditField
                  label="Assigned Agent (user_id)"
                  initial={rental.assigned_agent ?? ""}
                  onSave={(v) => update({ assigned_agent: v || null }, "Agent assigned")}
                />
              </div>
            </Section>

            {/* Section 6 — Agent Notes */}
            <Section title="Agent Notes">
              <Textarea
                rows={5}
                placeholder="Internal notes (auto-saves)…"
                value={notesDraft}
                onChange={(e) => scheduleNotesSave(e.target.value)}
              />
            </Section>

            {rentalId && (
              <CCAuthDialog
                open={ccAuthOpen}
                onOpenChange={setCcAuthOpen}
                rentalId={rentalId}
                initialCardholder={rental.cc_auth_cardholder_name ?? rental.driver_name}
                initialZip={rental.cc_auth_billing_zip}
                existingLastFour={rental.cc_auth_last_four}
                onAuthorized={async () => {
                  await refetch();
                  qc.invalidateQueries({ queryKey: ["car-rentals"] });
                  onUpdated?.();
                }}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ---------- Small UI helpers ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <Separator className="mb-3" />
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function ReadField({
  label,
  value,
  capitalize,
  full,
}: {
  label: string;
  value?: string | null;
  capitalize?: boolean;
  full?: boolean;
}) {
  return (
    <div className={cn(full && "sm:col-span-2")}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className={cn("text-sm py-1.5", capitalize && "capitalize")}>
        {value ? value : <span className="text-muted-foreground italic">—</span>}
      </div>
    </div>
  );
}

function EditField({
  label,
  initial,
  onSave,
  type = "text",
}: {
  label: string;
  initial: string;
  onSave: (v: string) => void;
  type?: string;
}) {
  const [val, setVal] = useState(initial);
  useEffect(() => setVal(initial), [initial]);
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val !== initial) onSave(val);
        }}
      />
    </div>
  );
}