import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, CalendarIcon, Star } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const TRIP_TYPES = [
  "Cruise Vacation",
  "All-Inclusive Resort",
  "Family Vacation",
  "Group Trip",
  "Luxury Travel",
  "Honeymoon",
];

type FeaturedTrip = {
  id: string;
  created_at: string | null;
  trip_name: string;
  destination: string;
  trip_type: string | null;
  depart_date: string | null;
  return_date: string | null;
  budget_range: string | null;
  deposit_amount: number | null;
  cover_image_url: string | null;
  tags: string[] | null;
  notes: string | null;
  published: boolean | null;
};

const emptyForm = {
  trip_name: "",
  destination: "",
  trip_type: "",
  depart_date: undefined as Date | undefined,
  return_date: undefined as Date | undefined,
  budget_range: "",
  deposit_amount: "",
  cover_image_url: "",
  tags: "",
  notes: "",
  published: false,
};

export default function FeaturedTrips() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["featured_trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_trips")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FeaturedTrip[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const payload: Record<string, unknown> = {
        trip_name: values.trip_name,
        destination: values.destination,
        trip_type: values.trip_type || null,
        depart_date: values.depart_date ? format(values.depart_date, "yyyy-MM-dd") : null,
        return_date: values.return_date ? format(values.return_date, "yyyy-MM-dd") : null,
        budget_range: values.budget_range || null,
        deposit_amount: values.deposit_amount ? Number(values.deposit_amount) : null,
        cover_image_url: values.cover_image_url || null,
        tags: values.tags ? values.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : null,
        notes: values.notes || null,
        published: values.published,
      };
      if (values.id) payload.id = values.id;

      const { error } = await supabase.from("featured_trips").upsert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["featured_trips"] });
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: editingId ? "Trip updated" : "Trip created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("featured_trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["featured_trips"] });
      setDeleteId(null);
      toast({ title: "Trip deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const togglePublished = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const { error } = await supabase.from("featured_trips").update({ published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["featured_trips"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (trip: FeaturedTrip) => {
    setEditingId(trip.id);
    setForm({
      trip_name: trip.trip_name,
      destination: trip.destination,
      trip_type: trip.trip_type || "",
      depart_date: trip.depart_date ? new Date(trip.depart_date + "T00:00:00") : undefined,
      return_date: trip.return_date ? new Date(trip.return_date + "T00:00:00") : undefined,
      budget_range: trip.budget_range || "",
      deposit_amount: trip.deposit_amount?.toString() || "",
      cover_image_url: trip.cover_image_url || "",
      tags: trip.tags?.join(", ") || "",
      notes: trip.notes || "",
      published: trip.published ?? false,
    });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.trip_name || !form.destination) {
      toast({ title: "Trip name and destination are required", variant: "destructive" });
      return;
    }
    upsertMutation.mutate({ ...form, id: editingId ?? undefined });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Star className="h-6 w-6 text-primary" />
              Featured Trips
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage marketing trips that appear on crestwellgetaways.com
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Trip
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : trips.length === 0 ? (
          <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground">
            <Star className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No featured trips yet</p>
            <p className="text-sm mt-1">Create your first marketing trip to attract leads on your public website.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Trip</Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Image</TableHead>
                  <TableHead>Trip Name</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Depart Date</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell>
                      {trip.cover_image_url ? (
                        <img
                          src={trip.cover_image_url}
                          alt={trip.trip_name}
                          className="w-12 h-8 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-8 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{trip.trip_name}</TableCell>
                    <TableCell>{trip.destination}</TableCell>
                    <TableCell>{trip.trip_type || "—"}</TableCell>
                    <TableCell>
                      {trip.depart_date ? format(new Date(trip.depart_date + "T00:00:00"), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>{trip.budget_range || "—"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={trip.published ?? false}
                        onCheckedChange={(val) => togglePublished.mutate({ id: trip.id, published: val })}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(trip)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(trip.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Featured Trip" : "New Featured Trip"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the details for this marketing trip." : "Add a new trip to your public website."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trip Name *</Label>
                <Input value={form.trip_name} onChange={(e) => setForm({ ...form, trip_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Destination *</Label>
                <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trip Type</Label>
                <Select value={form.trip_type} onValueChange={(v) => setForm({ ...form, trip_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {TRIP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Budget Range</Label>
                <Input placeholder='e.g. "From $699/person"' value={form.budget_range} onChange={(e) => setForm({ ...form, budget_range: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Depart Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.depart_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.depart_date ? format(form.depart_date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.depart_date} onSelect={(d) => setForm({ ...form, depart_date: d ?? undefined })} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Return Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.return_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.return_date ? format(form.return_date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.return_date} onSelect={(d) => setForm({ ...form, return_date: d ?? undefined })} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deposit Amount</Label>
                <Input type="number" placeholder="0.00" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input placeholder="beach, family, summer" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cover Image URL</Label>
              <Input placeholder="https://..." value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
              {form.cover_image_url && (
                <img src={form.cover_image_url} alt="Preview" className="mt-2 rounded-lg max-h-40 object-cover w-full" onError={(e) => (e.currentTarget.style.display = "none")} />
              )}
            </div>

            <div className="space-y-2">
              <Label>Description / Notes</Label>
              <Textarea rows={4} placeholder="Trip description shown on public website…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
              <Label>Published — visible on public website</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Saving…" : editingId ? "Update Trip" : "Create Trip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete featured trip?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this trip from the marketing listings. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
