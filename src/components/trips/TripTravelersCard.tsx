import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Users, Plus, Trash2, UserRound, X, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  useCompanions,
  useCreateCompanion,
  useDeleteCompanion,
} from "@/hooks/useCompanions";
import { Separator } from "@/components/ui/separator";

interface Client {
  id: string;
  name: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface TripTravelersCardProps {
  client: Client | null | undefined;
  clientId: string | null | undefined;
}

const RELATIONSHIPS = [
  "spouse",
  "partner",
  "child",
  "parent",
  "sibling",
  "friend",
  "colleague",
  "other",
];

export function TripTravelersCard({ client, clientId }: TripTravelersCardProps) {
  const { data: companions = [], isLoading } = useCompanions(clientId || undefined);
  const createCompanion = useCreateCompanion();
  const deleteCompanion = useDeleteCompanion();

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    relationship: "companion",
    email: "",
    phone: "",
  });

  const handleAdd = async () => {
    if (!clientId || !form.first_name.trim()) return;
    await createCompanion.mutateAsync({
      client_id: clientId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      relationship: form.relationship,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    });
    setForm({ first_name: "", last_name: "", relationship: "companion", email: "", phone: "" });
    setShowAddForm(false);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const totalTravelers = (client ? 1 : 0) + companions.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Travelers
            {totalTravelers > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({totalTravelers})
              </span>
            )}
          </CardTitle>
          {clientId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary"
              onClick={() => setShowAddForm((v) => !v)}
            >
              {showAddForm ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* No client */}
        {!client && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No client assigned to this trip
          </p>
        )}

        {/* Primary client */}
        {client && (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">
                {getInitials(client.name || "?")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{client.name}</p>
              <p className="text-xs text-muted-foreground">Primary traveler</p>
            </div>
            <Link to={`/contacts/${client.id}`}>
              <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </Link>
          </div>
        )}

        {/* Companions */}
        {companions.length > 0 && (
          <>
            {client && <Separator />}
            <div className="space-y-2">
              {companions.map((companion) => (
                <div key={companion.id} className="flex items-center gap-2.5 group">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {companion.first_name} {companion.last_name || ""}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {companion.relationship}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Traveler?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {companion.first_name} from the client's companion list.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() =>
                            deleteCompanion.mutate({ id: companion.id, clientId: companion.client_id })
                          }
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty companions state */}
        {client && companions.length === 0 && !showAddForm && !isLoading && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No additional travelers added
          </p>
        )}

        {/* Add traveler form */}
        {showAddForm && clientId && (
          <>
            <Separator />
            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Add Traveler
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">First Name *</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder="Jane"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Last Name</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder="Doe"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Relationship</Label>
                <Select
                  value={form.relationship}
                  onValueChange={(v) => setForm((f) => ({ ...f, relationship: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
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
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  className="h-8 text-sm"
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleAdd}
                  disabled={!form.first_name.trim() || createCompanion.isPending}
                >
                  Add Traveler
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
