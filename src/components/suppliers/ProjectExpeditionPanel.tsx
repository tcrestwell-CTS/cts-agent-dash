import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, Ticket } from "lucide-react";
import { toast } from "sonner";
import { parseLocalDate } from "@/lib/utils";
import { format } from "date-fns";

interface PeProduct {
  id?: string;
  product_id?: string;
  title?: string;
  name?: string;
  destination?: string;
  location?: string;
  description?: string;
  duration?: string;
  currency?: string;
  price?: number;
  from_price?: number;
  image?: string;
  image_url?: string;
}

interface PeBooking {
  id: string;
  pe_booking_ref: string | null;
  product_title: string;
  customer_name: string | null;
  customer_email: string | null;
  travel_date: string | null;
  travelers: number;
  total_price: number;
  currency: string;
  status: string;
  created_at: string;
}

const pid = (p: PeProduct) => String(p.id ?? p.product_id ?? "");
const ptitle = (p: PeProduct) => p.title ?? p.name ?? "Untitled activity";
const pprice = (p: PeProduct) => Number(p.price ?? p.from_price ?? 0);
const pimg = (p: PeProduct) => p.image ?? p.image_url;

async function callPe(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("project-expedition", { body });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      const payload = await response.clone().json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? error.message);
    }
    throw new Error(error.message);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

function safeDate(value: string | null) {
  if (!value) return "Date TBD";
  const d = parseLocalDate(value);
  return d && !isNaN(d.getTime()) ? format(d, "MMM d, yyyy") : "Date TBD";
}

export default function ProjectExpeditionPanel() {
  return (
    <Tabs defaultValue="search">
      <TabsList>
        <TabsTrigger value="search">Search tours</TabsTrigger>
        <TabsTrigger value="bookings">My bookings</TabsTrigger>
      </TabsList>
      <TabsContent value="search" className="mt-6"><SearchTab /></TabsContent>
      <TabsContent value="bookings" className="mt-6"><BookingsTab /></TabsContent>
    </Tabs>
  );
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<PeProduct[]>([]);
  const [selected, setSelected] = useState<PeProduct | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState("");

  const run = async () => {
    setLoading(true);
    setSearchError("");
    try {
      const data = await callPe({ action: "search", query, date: date || undefined, limit: 24 });
      setProducts(data.products ?? []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Search failed";
      setSearchError(message);
      toast.error(message);
      setProducts([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="pe-q">Destination or activity</Label>
          <Input id="pe-q" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Paris, Amsterdam canal cruise, Cozumel snorkel…"
            onKeyDown={(e) => e.key === "Enter" && run()} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pe-d">Travel date</Label>
          <Input id="pe-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">Search</span>
        </Button>
      </div>

      {searched && !loading && products.length === 0 && (
        <p className={`text-[13px] ${searchError ? "text-destructive" : "text-muted-foreground"}`}>
          {searchError || "No activities returned for that search."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => (
          <div key={pid(p)} className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
            {pimg(p) && <img src={pimg(p)} alt={ptitle(p)} loading="lazy" className="h-36 w-full object-cover" />}
            <div className="flex flex-1 flex-col gap-2 p-3.5">
              <p className="text-[13.5px] font-semibold leading-snug text-foreground">{ptitle(p)}</p>
              <p className="text-[12px] text-muted-foreground">{p.destination ?? p.location ?? ""}</p>
              {p.description && (
                <p className="line-clamp-3 text-[12px] text-muted-foreground">{p.description}</p>
              )}
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-[13px] font-semibold tabular-nums text-foreground">
                  {pprice(p) ? `${p.currency ?? "USD"} ${pprice(p).toFixed(2)}` : "Price on request"}
                </span>
                <Button size="sm" onClick={() => setSelected(p)}>Book</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <BookDialog product={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function BookDialog({ product, onClose }: { product: PeProduct | null; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", date: "", travelers: "2", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) setForm({ name: "", email: "", phone: "", date: "", travelers: "2", notes: "" });
  }, [product]);

  const submit = async () => {
    if (!product) return;
    if (!form.name || !form.email || !form.date) {
      toast.error("Traveler name, email, and travel date are required");
      return;
    }
    setSaving(true);
    try {
      await callPe({
        action: "book",
        productId: pid(product),
        productTitle: ptitle(product),
        destination: product.destination ?? product.location ?? null,
        travelDate: form.date,
        travelers: Number(form.travelers) || 1,
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: form.phone || undefined,
        notes: form.notes || undefined,
        currency: product.currency ?? "USD",
        totalPrice: pprice(product) * (Number(form.travelers) || 1),
      });
      toast.success("Booking submitted to Project Expedition");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Book {product ? ptitle(product) : "activity"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pe-name">Lead traveler</Label>
            <Input id="pe-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-email">Email</Label>
            <Input id="pe-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-phone">Phone</Label>
            <Input id="pe-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-date">Travel date</Label>
            <Input id="pe-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-trav">Travelers</Label>
            <Input id="pe-trav" type="number" min={1} value={form.travelers} onChange={(e) => setForm({ ...form, travelers: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pe-notes">Notes to supplier</Label>
            <Input id="pe-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookingsTab() {
  const [rows, setRows] = useState<PeBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("project_expedition_bookings")
        .select("id, pe_booking_ref, product_title, customer_name, customer_email, travel_date, travelers, total_price, currency, status, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) toast.error(error.message);
      setRows((data as PeBooking[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (rows.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Ticket className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">No Project Expedition bookings yet.</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      {rows.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3.5">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-foreground">{b.product_title}</p>
            <p className="text-[12px] text-muted-foreground">
              {b.customer_name ?? "—"} · {safeDate(b.travel_date)} · {b.travelers} traveler{b.travelers === 1 ? "" : "s"}
              {b.pe_booking_ref ? ` · Ref ${b.pe_booking_ref}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold tabular-nums text-foreground">
              {b.currency} {Number(b.total_price).toFixed(2)}
            </span>
            <Badge variant={b.status === "confirmed" ? "default" : b.status === "failed" ? "destructive" : "secondary"}>
              {b.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
