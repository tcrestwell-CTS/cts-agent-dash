import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Trash2,
  UserRound,
  Pencil,
  Crown,
  ChevronDown,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useClients } from "@/hooks/useClients";
import { useCompanions } from "@/hooks/useCompanions";
import { format, differenceInYears } from "date-fns";
import {
  useTripTravelers,
  useCreateTripTraveler,
  useUpdateTripTraveler,
  useDeleteTripTraveler,
  TripTraveler,
} from "@/hooks/useTripTravelers";

interface Client {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  birthday?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip_code?: string | null;
  address_country?: string | null;
  known_traveler_number?: string | null;
  passport_info?: string | null;
}

interface TripTravelersCardProps {
  client: Client | null | undefined;
  clientId: string | null | undefined;
  tripId: string;
}

const RELATIONSHIPS = [
  "traveler", "spouse", "partner", "child", "parent",
  "sibling", "friend", "colleague", "other",
];

const emptyForm = {
  first_name: "",
  last_name: "",
  relationship: "traveler",
  email: "",
  phone: "",
  birthday: "",
  known_traveler_number: "",
  passport_info: "",
  notes: "",
  is_primary: false,
};

export function TripTravelersCard({ client, clientId, tripId }: TripTravelersCardProps) {
  const { data: travelers = [], isLoading } = useTripTravelers(tripId);
  const { data: companions = [] } = useCompanions(clientId || undefined);
  const { data: allClients = [] } = useClients();
  const createTraveler = useCreateTripTraveler();
  const updateTraveler = useUpdateTripTraveler();
  const deleteTraveler = useDeleteTripTraveler();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTraveler, setEditingTraveler] = useState<TripTraveler | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [nameSearch, setNameSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
        <p className="text-xs select-all">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 mt-1"
        onClick={(e) => { e.stopPropagation(); copyToClipboard(value, label); }}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );

  const formatDob = (birthday: string | null | undefined) => {
    if (!birthday) return null;
    const d = new Date(birthday);
    const age = differenceInYears(new Date(), d);
    return `${format(d, "MM/dd/yyyy")} · ${format(d, "MMMM d, yyyy")} · ${age} years old`;
  };

  const getAddress = (c: Client) => {
    return [c.address_line_1, c.address_line_2, [c.address_city, c.address_state, c.address_zip_code].filter(Boolean).join(", "), c.address_country]
      .filter(Boolean)
      .join(", ");
  };

  const clientSuggestions = nameSearch.trim().length >= 2
    ? allClients.filter((c) => {
        const full = `${c.first_name || ""} ${c.last_name || ""} ${c.name}`.toLowerCase();
        return full.includes(nameSearch.toLowerCase());
      }).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNameChange = (value: string) => {
    setNameSearch(value);
    setForm((f) => ({ ...f, first_name: value }));
    setShowSuggestions(true);
  };

  const selectClientSuggestion = (c: typeof allClients[0]) => {
    const firstName = c.first_name || c.name.split(" ")[0] || "";
    const lastName = c.last_name || c.name.split(" ").slice(1).join(" ") || "";
    setForm((f) => ({
      ...f,
      first_name: firstName,
      last_name: lastName,
      email: c.email || f.email,
      phone: c.phone || f.phone,
      known_traveler_number: (c as any).known_traveler_number || f.known_traveler_number,
      passport_info: (c as any).passport_info || f.passport_info,
    }));
    setNameSearch(firstName);
    setShowSuggestions(false);
  };

  const openAdd = () => {
    setForm(emptyForm);
    setNameSearch("");
    setEditingTraveler(null);
    setShowAddDialog(true);
  };

  const openEdit = (t: TripTraveler) => {
    setForm({
      first_name: t.first_name,
      last_name: t.last_name || "",
      relationship: t.relationship || "traveler",
      email: t.email || "",
      phone: t.phone || "",
      birthday: t.birthday || "",
      known_traveler_number: t.known_traveler_number || "",
      passport_info: t.passport_info || "",
      notes: t.notes || "",
      is_primary: t.is_primary,
    });
    setNameSearch(t.first_name);
    setEditingTraveler(t);
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!form.first_name.trim()) return;
    if (editingTraveler) {
      await updateTraveler.mutateAsync({
        id: editingTraveler.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        relationship: form.relationship,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        birthday: form.birthday.trim() || null,
        known_traveler_number: form.known_traveler_number.trim() || null,
        passport_info: form.passport_info.trim() || null,
        notes: form.notes.trim() || null,
        is_primary: form.is_primary,
      });
    } else {
      await createTraveler.mutateAsync({
        trip_id: tripId,
        client_id: clientId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        relationship: form.relationship,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        birthday: form.birthday.trim() || null,
        known_traveler_number: form.known_traveler_number.trim() || null,
        passport_info: form.passport_info.trim() || null,
        notes: form.notes.trim() || null,
        is_primary: form.is_primary,
      });
    }
    setShowAddDialog(false);
    setEditingTraveler(null);
  };

  const getInitials = (first: string, last?: string | null) =>
    `${first[0] || ""}${last?.[0] || ""}`.toUpperCase();

  const isPending = createTraveler.isPending || updateTraveler.isPending;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Travelers
              {travelers.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({travelers.length})
                </span>
              )}
            </CardTitle>
            <Button
              variant="default"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={openAdd}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-1 pt-0">
          {/* Primary client - expandable */}
          {client && (
            <>
              <button
                onClick={() => toggleExpand("client")}
                className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-muted/50 rounded-lg px-1.5 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">
                    {getInitials(client.name.split(" ")[0], client.name.split(" ")[1])}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                    <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                  </div>
                  {client.email && (
                    <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">Primary</Badge>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === "client" ? "rotate-180" : ""}`} />
              </button>
              {expandedId === "client" && (
                <div className="space-y-1.5 pb-2 pl-12">
                  {client.birthday && <DetailRow label="Birthday" value={formatDob(client.birthday)!} />}
                  {getAddress(client) && <DetailRow label="Address" value={getAddress(client)} />}
                  {client.email && <DetailRow label="Email" value={client.email} />}
                  {client.phone && <DetailRow label="Phone" value={client.phone} />}
                  {client.known_traveler_number && <DetailRow label="Known Traveler #" value={client.known_traveler_number} />}
                  <div className="pt-1">
                    <Link to={`/contacts/${client.id}`} className="text-xs text-primary hover:underline">
                      View full profile →
                    </Link>
                  </div>
                </div>
              )}
              {(travelers.length > 0 || companions.length > 0) && <Separator />}
            </>
          )}

          {travelers.length === 0 && !isLoading && companions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              {client ? "No additional travelers yet" : "No travelers added yet"}
            </p>
          )}

          {/* Trip travelers - expandable */}
          <div className="space-y-1">
            {travelers.map((t) => (
              <div key={t.id}>
                <button
                  onClick={() => toggleExpand(t.id)}
                  className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-muted/50 rounded-lg px-1.5 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    {t.is_primary ? (
                      <Crown className="h-4 w-4 text-amber-500" />
                    ) : (
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.first_name} {t.last_name || ""}
                    </p>
                    {t.email && (
                      <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                    {t.relationship}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === t.id ? "rotate-180" : ""}`} />
                </button>
                {expandedId === t.id && (
                  <div className="space-y-1.5 pb-2 pl-12">
                    {t.birthday && <DetailRow label="Birthday" value={formatDob(t.birthday)!} />}
                    {t.email && <DetailRow label="Email" value={t.email} />}
                    {t.phone && <DetailRow label="Phone" value={t.phone} />}
                    {t.known_traveler_number && <DetailRow label="Known Traveler #" value={t.known_traveler_number} />}
                    {t.passport_info && <DetailRow label="Passport" value={t.passport_info} />}
                    <div className="pt-1 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Traveler?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove {t.first_name} from this trip.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteTraveler.mutate({ id: t.id, tripId })}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Travel Companions from client profile */}
          {(() => {
            const travelerNames = new Set(
              travelers.map((t) => `${t.first_name}|${t.last_name || ""}`.toLowerCase())
            );
            const unlinkedCompanions = companions.filter(
              (c) => !travelerNames.has(`${c.first_name}|${c.last_name || ""}`.toLowerCase())
            );
            if (unlinkedCompanions.length === 0) return null;
            return (
              <>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground pt-1">
                  Travel Companions
                </p>
                <div className="space-y-1">
                  {unlinkedCompanions.map((c) => (
                    <div key={c.id}>
                      <button
                        onClick={() => toggleExpand(`comp-${c.id}`)}
                        className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-muted/50 rounded-lg px-1.5 transition-colors group"
                      >
                        <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0 border border-dashed border-border">
                          <UserRound className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {c.first_name} {c.last_name || ""}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{c.relationship}</p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === `comp-${c.id}` ? "rotate-180" : ""}`} />
                      </button>
                      {expandedId === `comp-${c.id}` && (
                        <div className="space-y-1.5 pb-2 pl-12">
                          {c.birthday && <DetailRow label="Birthday" value={formatDob(c.birthday)!} />}
                          {c.email && <DetailRow label="Email" value={c.email} />}
                          {c.phone && <DetailRow label="Phone" value={c.phone} />}
                          {c.known_traveler_number && <DetailRow label="Known Traveler #" value={c.known_traveler_number} />}
                          {c.passport_info && <DetailRow label="Passport" value={c.passport_info} />}
                          <div className="pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                createTraveler.mutate({
                                  trip_id: tripId,
                                  client_id: clientId,
                                  first_name: c.first_name,
                                  last_name: c.last_name,
                                  relationship: c.relationship,
                                  email: c.email,
                                  phone: c.phone,
                                  birthday: c.birthday,
                                  known_traveler_number: c.known_traveler_number,
                                  passport_info: c.passport_info,
                                  notes: c.notes,
                                });
                              }}
                              disabled={createTraveler.isPending}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add to Trip
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) setShowAddDialog(false); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              {editingTraveler ? "Edit Traveler" : "Add Traveler"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First Name *</Label>
                <div className="relative" ref={suggestionsRef}>
                  <Input
                    placeholder="Jane"
                    value={nameSearch}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={() => nameSearch.trim().length >= 2 && setShowSuggestions(true)}
                    autoComplete="off"
                  />
                  {showSuggestions && clientSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                      {clientSuggestions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex flex-col gap-0.5"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectClientSuggestion(c);
                          }}
                        >
                          <span className="font-medium">{c.name}</span>
                          {c.email && (
                            <span className="text-xs text-muted-foreground">{c.email}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last Name</Label>
                <Input
                  placeholder="Doe"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Relationship</Label>
              <Select
                value={form.relationship}
                onValueChange={(v) => setForm((f) => ({ ...f, relationship: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  type="tel"
                  placeholder="+1 555 000 0000"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Birthday</Label>
                <Input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Known Traveler # (TSA)</Label>
                <Input
                  placeholder="KTN..."
                  value={form.known_traveler_number}
                  onChange={(e) => setForm((f) => ({ ...f, known_traveler_number: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Passport Info</Label>
              <Input
                placeholder="Passport number, expiry, etc."
                value={form.passport_info}
                onChange={(e) => setForm((f) => ({ ...f, passport_info: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                placeholder="Dietary needs, accessibility, etc."
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="is_primary"
                type="checkbox"
                className="h-4 w-4 rounded border border-input"
                checked={form.is_primary}
                onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
              />
              <Label htmlFor="is_primary" className="text-sm cursor-pointer">
                Mark as primary traveler
              </Label>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.first_name.trim() || isPending}
            >
              {isPending ? "Saving..." : editingTraveler ? "Save Changes" : "Add Traveler"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
