import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, Plane, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { parseLocalDate } from "@/lib/utils";
import { format } from "date-fns";

const ADX_DASHBOARD_URL = "https://adx.traveledge.com";

interface AdxProduct {
  id?: string;
  product_id?: string;
  title?: string;
  name?: string;
  type?: string;
  product_type?: string;
  destination?: string;
  location?: string;
  description?: string;
  currency?: string;
  price?: number;
  from_price?: number;
  image?: string;
  image_url?: string;
}

interface AdxBooking {
  id: string;
  adx_booking_ref: string | null;
  product_title: string;
  product_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  travel_date: string | null;
  travelers: number;
  total_price: number;
  currency: string;
  status: string;
  booking_id: string | null;
  created_at: string;
}

const pid = (p: AdxProduct) => String(p.id ?? p.product_id ?? "");
const ptitle = (p: AdxProduct) => p.title ?? p.name ?? "Untitled product";
const ptype = (p: AdxProduct) => p.type ?? p.product_type ?? null;
const pprice = (p: AdxProduct) => Number(p.price ?? p.from_price ?? 0);
const pimg = (p: AdxProduct) => p.image ?? p.image_url;

async function callAdx(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("adx", { body });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      const payload = await response.clone().json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? error.message);
    }
    throw new Error(error.message);
  }
  if ((data as any)?.error && (data as any)?.code !== "ADX_NOT_CONFIGURED") {
    throw new Error((data as any).error);
  }
  return data as any;
}

function safeDate(value: string | null) {
  if (!value) return "Date TBD";
  const d = parseLocalDate(value);
  return d && !isNaN(d.getTime()) ? format(d, "MMM d, yyyy") : "Date TBD";
}

export default function AdxPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    callAdx({ action: "status" })
      .then((d) => setConfigured(!!d?.configured))
      .catch(() => setConfigured(false));
  }, []);

  if (configured === null) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!configured) return <TrackingMode />;

  return (
    <Tabs defaultValue="search">
      <TabsList>
        <TabsTrigger value="search">Search ADX</TabsTrigger>
        <TabsTrigger value="bookings">My bookings</TabsTrigger>
      </TabsList>
      <TabsContent value="search" className="mt-6"><SearchTab /></TabsContent>
      <TabsContent value="bookings" className="mt-6"><BookingsTab /></TabsContent>
    </Tabs>
  );
}

function TrackingMode() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center space-y-3">
        <Plane className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="text-[14px] font-semibold text-foreground">ADX API not connected yet</p>
        <p className="mx-auto max-w-lg text-[13px] text-muted-foreground">
          Book air, hotel, and cruise in the ADX dashboard, then log the booking on the trip with
          supplier <span className="font-medium text-foreground">ADX (Travel Edge)</span> — commission
          and margin lines flow through the margin engine automatically. API search and one-click
          booking turn on here as soon as Ensemble / Travel Edge issues your API credentials.
        </p>
        <Button asChild>
          <a href={ADX_DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open ADX Dashboard
          </a>
        </Button>
      </div>
      <BookingsTab />
    </div>
  );
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const [productType, setProductType] = useState("all");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<AdxProduct[]>([]);
  const [selected, setSelected] = useState<AdxProduct | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState("");

  const run = async () => {
    setLoading(true);
    setSearchError("");
    try {
      const data = await callAdx({
        action: "search",
        query,
        date: date || undefined,
        productType: productType === "all" ? undefined : productType,
        limit: 24,
      });
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
          <Label htmlFor="adx-q">Destination, hotel, or route</Label>
          <Input id="adx-q" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Cancun all-inclusive, JFK to LHR, Paris hotel…"
            onKeyDown={(e) => e.key === "Enter" && run()} />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="air">Air</SelectItem>
              <SelectItem value="hotel">Hotel</SelectItem>
              <SelectItem value="cruise">Cruise</SelectItem>
              <SelectItem value="tour">Tour / DMC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adx-d">Travel date</Label>
          <Input id="adx-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">Search</span>
        </Button>
      </div>

      {searched && !loading && products.length === 0 && (
        <p className={`text-[13px] ${searchError ? "text-destructive" : "text-muted-foreground"}`}>
          {searchError || "No products returned for that search."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => (
          <div key={pid(p)} className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
            {pimg(p) && <img src={pimg(p)} alt={ptitle(p)} loading="lazy" className="h-36 w-full object-cover" />}
            <div className="flex flex-1 flex-col gap-2 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13.5px] font-semibold leading-snug text-foreground">{ptitle(p)}</p>
                {ptype(p) && <Badge variant="secondary" className="capitalize shrink-0">{ptype(p)}</Badge>}
              </div>
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

function BookDialog({ product, onClose }: { product: AdxProduct | null; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", date: "", returnDate: "", travelers: "2", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) setForm({ name: "", email: "", phone: "", date: "", returnDate: "", travelers: "2", notes: "" });
  }, [product]);

  const submit = async () => {
    if (!product) return;
    if (!form.name || !form.email || !form.date) {
      toast.error("Traveler name, email, and travel date are required");
      return;
    }
    setSaving(true);
    try {
      const result = await callAdx({
        action: "book",
        productId: pid(product),
        productTitle: ptitle(product),
        productType: ptype(product),
        destination: product.destination ?? product.location ?? null,
        travelDate: form.date,
        returnDate: form.returnDate || undefined,
        travelers: Number(form.travelers) || 1,
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: form.phone || undefined,
        notes: form.notes || undefined,
        currency: product.currency ?? "USD",
        totalPrice: pprice(product) * (Number(form.travelers) || 1),
      });
      toast.success(result?.crm_booking_id
        ? "Booked in ADX and added to your bookings with margin lines"
        : "Booking submitted to ADX");
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
        <DialogHeader><DialogTitle>Book {product ? ptitle(product) : "product"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="adx-name">Lead traveler</Label>
            <Input id="adx-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adx-email">Email</Label>
            <Input id="adx-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adx-phone">Phone</Label>
            <Input id="adx-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adx-date">Travel date</Label>
            <Input id="adx-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adx-ret">Return date</Label>
            <Input id="adx-ret" type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adx-trav">Travelers</Label>
            <Input id="adx-trav" type="number" min={1} value={form.travelers} onChange={(e) => setForm({ ...form, travelers: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="adx-notes">Notes to supplier</Label>
            <Input id="adx-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
  const [rows, setRows] = useState<AdxBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("adx_bookings")
        .select("id, adx_booking_ref, product_title, product_type, customer_name, customer_email, travel_date, travelers, total_price, currency, status, booking_id, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) toast.error(error.message);
      setRows((data as AdxBooking[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (rows.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Plane className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">No ADX bookings yet.</p>
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
              {b.adx_booking_ref ? ` · Ref ${b.adx_booking_ref}` : ""}
              {b.booking_id ? " · In CRM" : ""}
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
