/**
 * Admin: configure the public booking wizard for a group trip.
 * /trips/:tripId/booking-setup
 *
 * Tabs: Settings (sailing facts, taxes, deposit, included, terms, promo codes) ·
 *       Staterooms (trip_cabin_options with category tabs, occupancy pricing, inventory) ·
 *       Add-ons (trip_addons) · Bookings (group_bookings received)
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, ExternalLink, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { money } from "@/lib/groupPricing";

const CATEGORY_GROUPS = ["Inside", "Ocean View", "Veranda", "Concierge", "Suite", "Other"];

type CabinRow = {
  id?: string; trip_id: string; category_group: string; category_name: string; description: string | null;
  price_per_person: number; price_period: string; third_fourth_price: number | null; child_price: number | null;
  single_supplement_pct: number; deposit_amount: number | null; sleeps_min: number; sleeps_max: number; sqft: string | null;
  features: string[]; images: string[]; image_url: string | null; inventory: number | null; sold_out: boolean;
  accessible_available: boolean; badge: string | null; sort_order: number; capacity: number | null;
};
type AddonRow = { id?: string; trip_id: string; name: string; description: string | null; price: number; price_basis: "per_person" | "per_room" | "per_booking"; image_url: string | null; sort_order: number; enabled: boolean };

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

export default function GroupBookingSetup() {
  const { tripId } = useParams<{ tripId: string }>();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<any>(null);
  const [cabins, setCabins] = useState<CabinRow[]>([]);
  const [addons, setAddons] = useState<AddonRow[]>([]);

  const tripQ = useQuery({
    queryKey: ["trip-booking-setup", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select("id, trip_name, trip_type, share_token, trip_page_url, group_landing_enabled, booking_flow_enabled, ship_name, ship_name_display, depart_port, ports_of_call, taxes_fees_per_person, group_deposit_per_person, final_payment_due, group_included_items, group_terms, max_rooms_per_booking, promo_codes, currency").eq("id", tripId!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!tripId,
  });
  const cabinsQ = useQuery({
    queryKey: ["trip-cabins", tripId],
    queryFn: async () => { const { data, error } = await supabase.from("trip_cabin_options").select("*").eq("trip_id", tripId!).order("sort_order"); if (error) throw error; return data as CabinRow[]; },
    enabled: !!tripId,
  });
  const addonsQ = useQuery({
    queryKey: ["trip-addons", tripId],
    queryFn: async () => { const { data, error } = await supabase.from("trip_addons").select("*").eq("trip_id", tripId!).order("sort_order"); if (error) throw error; return data as AddonRow[]; },
    enabled: !!tripId,
  });
  const bookingsQ = useQuery({
    queryKey: ["group-bookings", tripId],
    queryFn: async () => { const { data, error } = await supabase.from("group_bookings").select("id, status, contact_first_name, contact_last_name, contact_email, rooms, total_cents, deposit_cents, currency, created_at, paid_at, sub_trip_id").eq("trip_id", tripId!).order("created_at", { ascending: false }); if (error) throw error; return data as any[]; },
    enabled: !!tripId,
  });

  useEffect(() => { if (tripQ.data && !settings) setSettings({
    ...tripQ.data,
    ports_text: (tripQ.data.ports_of_call ?? []).join("\n"),
    included_text: (tripQ.data.group_included_items ?? []).join("\n"),
    promo_text: JSON.stringify(tripQ.data.promo_codes ?? [], null, 2),
  }); }, [tripQ.data, settings]);
  useEffect(() => { if (cabinsQ.data) setCabins(cabinsQ.data); }, [cabinsQ.data]);
  useEffect(() => { if (addonsQ.data) setAddons(addonsQ.data); }, [addonsQ.data]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      let promo_codes: any[] = [];
      try { promo_codes = JSON.parse(settings.promo_text || "[]"); } catch { throw new Error("Promo codes must be valid JSON (an array)"); }
      const { error } = await supabase.from("trips").update({
        booking_flow_enabled: !!settings.booking_flow_enabled,
        ship_name_display: settings.ship_name_display || null,
        depart_port: settings.depart_port || null,
        ports_of_call: lines(settings.ports_text || ""),
        taxes_fees_per_person: Number(settings.taxes_fees_per_person || 0),
        group_deposit_per_person: numOrNull(String(settings.group_deposit_per_person ?? "")),
        final_payment_due: settings.final_payment_due || null,
        group_included_items: lines(settings.included_text || ""),
        group_terms: settings.group_terms || null,
        max_rooms_per_booking: Number(settings.max_rooms_per_booking || 4),
        promo_codes,
      }).eq("id", tripId!);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["trip-booking-setup", tripId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveCabins = useMutation({
    mutationFn: async () => {
      const rows = cabins.map((c, i) => ({ ...c, trip_id: tripId!, sort_order: i, price_period: c.price_period || "trip", capacity: c.sleeps_max }));
      for (const r of rows) {
        const { id, ...rest } = r as any;
        const res = id ? await supabase.from("trip_cabin_options").update(rest).eq("id", id) : await supabase.from("trip_cabin_options").insert(rest);
        if (res.error) throw res.error;
      }
    },
    onSuccess: () => { toast.success("Staterooms saved"); qc.invalidateQueries({ queryKey: ["trip-cabins", tripId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteCabin = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("trip_cabin_options").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-cabins", tripId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const saveAddons = useMutation({
    mutationFn: async () => {
      for (const [i, a] of addons.entries()) {
        const { id, ...rest } = { ...a, trip_id: tripId!, sort_order: i } as any;
        const res = id ? await supabase.from("trip_addons").update(rest).eq("id", id) : await supabase.from("trip_addons").insert(rest);
        if (res.error) throw res.error;
      }
    },
    onSuccess: () => { toast.success("Add-ons saved"); qc.invalidateQueries({ queryKey: ["trip-addons", tripId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteAddon = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("trip_addons").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-addons", tripId] }),
  });

  const publicBase = (() => { try { return tripQ.data?.trip_page_url ? new URL(tripQ.data.trip_page_url).origin : window.location.origin; } catch { return window.location.origin; } })();
  const bookUrl = tripQ.data?.share_token ? `${publicBase}/group/${tripQ.data.share_token}/book` : null;

  if (tripQ.isLoading || !settings) return <DashboardLayout><div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div></DashboardLayout>;
  if (tripQ.data?.trip_type !== "group") return <DashboardLayout><Card><CardContent className="py-12 text-center">This trip is not a group trip. <Link to={`/trips/${tripId}`} className="text-primary underline">Back to trip</Link></CardContent></Card></DashboardLayout>;

  const patchCabin = (i: number, p: Partial<CabinRow>) => setCabins((cs) => cs.map((c, k) => (k === i ? { ...c, ...p } : c)));
  const patchAddon = (i: number, p: Partial<AddonRow>) => setAddons((as) => as.map((a, k) => (k === i ? { ...a, ...p } : a)));
  const cur = (tripQ.data?.currency || "USD").toUpperCase();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Link to={`/trips/${tripId}`} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> {tripQ.data.trip_name}</Link>
            <h1 className="text-2xl font-bold tracking-tight">Group booking setup</h1>
            <p className="text-sm text-muted-foreground">Six-step public booking wizard: rooms, staterooms, add-ons, guests, deposit.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2"><Switch checked={!!settings.booking_flow_enabled} onCheckedChange={(v) => setSettings({ ...settings, booking_flow_enabled: v })} /><span className="text-sm">{settings.booking_flow_enabled ? "Live" : "Off"}</span></div>
            {bookUrl && <Button asChild variant="outline" size="sm"><a href={bookUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Open wizard</a></Button>}
            <Link to={`/trips/${tripId}/landing-page`} className="text-sm text-primary underline-offset-2 hover:underline">Landing page</Link>
          </div>
        </div>
        {!tripQ.data.group_landing_enabled && <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="py-3 text-sm">The landing page is disabled, so the wizard will return "not available" even when Live. Enable it on the Landing page builder.</CardContent></Card>}

        <Tabs defaultValue="settings">
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="cabins">Staterooms ({cabins.length})</TabsTrigger>
            <TabsTrigger value="addons">Add-ons ({addons.length})</TabsTrigger>
            <TabsTrigger value="bookings">Bookings ({bookingsQ.data?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* Settings */}
          <TabsContent value="settings">
            <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-2">
              <div><Label>Ship / property (display)</Label><Input value={settings.ship_name_display ?? settings.ship_name ?? ""} onChange={(e) => setSettings({ ...settings, ship_name_display: e.target.value })} placeholder="Celebrity Reflection" /></div>
              <div><Label>Leaving from</Label><Input value={settings.depart_port ?? ""} onChange={(e) => setSettings({ ...settings, depart_port: e.target.value })} placeholder="Fort Lauderdale, Florida" /></div>
              <div><Label>Ports of call (one per line)</Label><Textarea rows={4} value={settings.ports_text} onChange={(e) => setSettings({ ...settings, ports_text: e.target.value })} /></div>
              <div><Label>Included in your trip (one per line)</Label><Textarea rows={4} value={settings.included_text} onChange={(e) => setSettings({ ...settings, included_text: e.target.value })} placeholder={"Main dining and buffet\nPrivate group reception\nOnboard credit"} /></div>
              <div><Label>Taxes & fees per person ({cur})</Label><Input type="number" step="0.01" value={settings.taxes_fees_per_person ?? 0} onChange={(e) => setSettings({ ...settings, taxes_fees_per_person: e.target.value })} /></div>
              <div><Label>Default deposit per person ({cur})</Label><Input type="number" step="0.01" value={settings.group_deposit_per_person ?? ""} onChange={(e) => setSettings({ ...settings, group_deposit_per_person: e.target.value })} placeholder="Used when a stateroom has no deposit set" /></div>
              <div><Label>Final payment due</Label><Input type="date" value={settings.final_payment_due ?? ""} onChange={(e) => setSettings({ ...settings, final_payment_due: e.target.value })} /></div>
              <div><Label>Max rooms per booking</Label><Input type="number" min={1} max={10} value={settings.max_rooms_per_booking ?? 4} onChange={(e) => setSettings({ ...settings, max_rooms_per_booking: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Booking terms (shown at guest info)</Label><Textarea rows={5} value={settings.group_terms ?? ""} onChange={(e) => setSettings({ ...settings, group_terms: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Promo codes (JSON)</Label><Textarea rows={4} className="font-mono text-xs" value={settings.promo_text} onChange={(e) => setSettings({ ...settings, promo_text: e.target.value })} /><p className="text-xs text-muted-foreground mt-1">{'e.g. [{"code":"EARLYBIRD","label":"Early bird","percent_off":5}, {"code":"VET50","label":"Veteran","amount_off_per_person":50}]'}</p></div>
              <div className="md:col-span-2 flex justify-end"><Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}><Save className="h-4 w-4 mr-1" /> Save settings</Button></div>
            </CardContent></Card>
          </TabsContent>

          {/* Staterooms */}
          <TabsContent value="cabins" className="space-y-3">
            <p className="text-sm text-muted-foreground">Guests 1-2 pay the per-person price; a solo guest pays it plus the single supplement; guests 3-4 pay the 3rd/4th price. Inventory counts rooms held in your block; leave blank for unlimited.</p>
            {cabins.map((c, i) => (
              <Card key={c.id ?? `new-${i}`}><CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">{c.category_name || "New stateroom"} <Badge variant="outline">{c.category_group}</Badge>{c.sold_out && <Badge variant="destructive">Sold out</Badge>}</CardTitle>
                <Button size="icon" variant="ghost" onClick={() => c.id ? deleteCabin.mutate(c.id) : setCabins((cs) => cs.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <div><Label>Category tab</Label><Select value={c.category_group} onValueChange={(v) => patchCabin(i, { category_group: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORY_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select></div>
                <div className="md:col-span-2"><Label>Stateroom name</Label><Input value={c.category_name} onChange={(e) => patchCabin(i, { category_name: e.target.value })} placeholder="Prime Inside Stateroom" /></div>
                <div><Label>Badge</Label><Input value={c.badge ?? ""} onChange={(e) => patchCabin(i, { badge: e.target.value || null })} placeholder="Lowest Price" /></div>
                <div><Label>Price / person ({cur})</Label><Input type="number" step="0.01" value={c.price_per_person} onChange={(e) => patchCabin(i, { price_per_person: Number(e.target.value) })} /></div>
                <div><Label>3rd/4th guest</Label><Input type="number" step="0.01" value={c.third_fourth_price ?? ""} onChange={(e) => patchCabin(i, { third_fourth_price: numOrNull(e.target.value) })} placeholder="= per person" /></div>
                <div><Label>Child price</Label><Input type="number" step="0.01" value={c.child_price ?? ""} onChange={(e) => patchCabin(i, { child_price: numOrNull(e.target.value) })} placeholder="= seat price" /></div>
                <div><Label>Single supplement %</Label><Input type="number" value={c.single_supplement_pct} onChange={(e) => patchCabin(i, { single_supplement_pct: Number(e.target.value) })} /></div>
                <div><Label>Deposit / person</Label><Input type="number" step="0.01" value={c.deposit_amount ?? ""} onChange={(e) => patchCabin(i, { deposit_amount: numOrNull(e.target.value) })} placeholder="= trip default" /></div>
                <div><Label>Sleeps min</Label><Input type="number" min={1} value={c.sleeps_min} onChange={(e) => patchCabin(i, { sleeps_min: Number(e.target.value) })} /></div>
                <div><Label>Sleeps max</Label><Input type="number" min={1} max={6} value={c.sleeps_max} onChange={(e) => patchCabin(i, { sleeps_max: Number(e.target.value) })} /></div>
                <div><Label>Sq. ft.</Label><Input value={c.sqft ?? ""} onChange={(e) => patchCabin(i, { sqft: e.target.value || null })} placeholder="183-245" /></div>
                <div><Label>Inventory (rooms)</Label><Input type="number" value={c.inventory ?? ""} onChange={(e) => patchCabin(i, { inventory: numOrNull(e.target.value) })} placeholder="unlimited" /></div>
                <div className="flex items-center gap-2 pt-6"><Switch checked={c.sold_out} onCheckedChange={(v) => patchCabin(i, { sold_out: v })} /><span className="text-sm">Sold out</span></div>
                <div className="flex items-center gap-2 pt-6"><Switch checked={c.accessible_available} onCheckedChange={(v) => patchCabin(i, { accessible_available: v })} /><span className="text-sm">Accessible available</span></div>
                <div className="md:col-span-2"><Label>Features (one per line)</Label><Textarea rows={3} value={(c.features ?? []).join("\n")} onChange={(e) => patchCabin(i, { features: lines(e.target.value) })} placeholder={"Located on lower decks\nAmple living space, including a sitting area"} /></div>
                <div className="md:col-span-2"><Label>Image URLs (one per line)</Label><Textarea rows={3} value={(c.images?.length ? c.images : c.image_url ? [c.image_url] : []).join("\n")} onChange={(e) => { const imgs = lines(e.target.value); patchCabin(i, { images: imgs, image_url: imgs[0] ?? null }); }} /></div>
                <div className="md:col-span-4"><Label>Description</Label><Input value={c.description ?? ""} onChange={(e) => patchCabin(i, { description: e.target.value || null })} /></div>
              </CardContent></Card>
            ))}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCabins((cs) => [...cs, { trip_id: tripId!, category_group: "Inside", category_name: "", description: null, price_per_person: 0, price_period: "trip", third_fourth_price: null, child_price: null, single_supplement_pct: 100, deposit_amount: null, sleeps_min: 1, sleeps_max: 2, sqft: null, features: [], images: [], image_url: null, inventory: null, sold_out: false, accessible_available: true, badge: null, sort_order: cs.length, capacity: 2 }])}><Plus className="h-4 w-4 mr-1" /> Add stateroom</Button>
              <Button onClick={() => saveCabins.mutate()} disabled={saveCabins.isPending}><Save className="h-4 w-4 mr-1" /> Save staterooms</Button>
            </div>
          </TabsContent>

          {/* Add-ons */}
          <TabsContent value="addons" className="space-y-3">
            {addons.map((a, i) => (
              <Card key={a.id ?? `new-${i}`}><CardContent className="pt-6 grid gap-3 md:grid-cols-5 items-end">
                <div className="md:col-span-2"><Label>Name</Label><Input value={a.name} onChange={(e) => patchAddon(i, { name: e.target.value })} placeholder="Classic drinks package" /></div>
                <div><Label>Price ({cur})</Label><Input type="number" step="0.01" value={a.price} onChange={(e) => patchAddon(i, { price: Number(e.target.value) })} /></div>
                <div><Label>Basis</Label><Select value={a.price_basis} onValueChange={(v) => patchAddon(i, { price_basis: v as any })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="per_person">Per person</SelectItem><SelectItem value="per_room">Per room</SelectItem><SelectItem value="per_booking">Per booking (qty)</SelectItem></SelectContent></Select></div>
                <div className="flex items-center gap-2"><Switch checked={a.enabled} onCheckedChange={(v) => patchAddon(i, { enabled: v })} /><span className="text-sm">Enabled</span><Button size="icon" variant="ghost" className="ml-auto" onClick={() => a.id ? deleteAddon.mutate(a.id) : setAddons((as) => as.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button></div>
                <div className="md:col-span-3"><Label>Description</Label><Input value={a.description ?? ""} onChange={(e) => patchAddon(i, { description: e.target.value || null })} /></div>
                <div className="md:col-span-2"><Label>Image URL</Label><Input value={a.image_url ?? ""} onChange={(e) => patchAddon(i, { image_url: e.target.value || null })} /></div>
              </CardContent></Card>
            ))}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setAddons((as) => [...as, { trip_id: tripId!, name: "", description: null, price: 0, price_basis: "per_person", image_url: null, sort_order: as.length, enabled: true }])}><Plus className="h-4 w-4 mr-1" /> Add add-on</Button>
              <Button onClick={() => saveAddons.mutate()} disabled={saveAddons.isPending}><Save className="h-4 w-4 mr-1" /> Save add-ons</Button>
            </div>
          </TabsContent>

          {/* Bookings */}
          <TabsContent value="bookings">
            <Card><CardContent className="pt-6">
              {!bookingsQ.data?.length ? <p className="text-sm text-muted-foreground text-center py-8">No bookings through the wizard yet.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Guest</TableHead><TableHead>Rooms</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Deposit</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {bookingsQ.data.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{format(new Date(b.created_at), "MMM d, h:mm a")}</TableCell>
                        <TableCell><div className="font-medium">{b.contact_first_name} {b.contact_last_name}</div><div className="text-xs text-muted-foreground">{b.contact_email}</div></TableCell>
                        <TableCell>{(b.rooms ?? []).length} · {(b.rooms ?? []).reduce((s: number, r: any) => s + (r.adults || 0) + (r.children || 0), 0)} guests</TableCell>
                        <TableCell className="text-right">{money(b.total_cents / 100, (b.currency || "usd").toUpperCase())}</TableCell>
                        <TableCell className="text-right">{money(b.deposit_cents / 100, (b.currency || "usd").toUpperCase())}</TableCell>
                        <TableCell><Badge variant={b.status === "deposit_paid" ? "default" : b.status === "pending_payment" ? "secondary" : "destructive"}>{b.status.replace("_", " ")}</Badge></TableCell>
                        <TableCell>{b.sub_trip_id && <Link className="text-primary text-sm underline-offset-2 hover:underline" to={`/trips/${b.sub_trip_id}`}>Open trip</Link>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
