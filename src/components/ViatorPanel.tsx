"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Ticket, Search, List, Star, Clock, Check, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const PORT_OPTIONS = [
  { label: "Caribbean (All Ports)", value: "caribbean" },
  { label: "Nassau, Bahamas", value: "nassau" },
  { label: "Cozumel, Mexico", value: "cozumel" },
  { label: "St. Thomas, USVI", value: "st-thomas" },
  { label: "St. Maarten", value: "st-maarten" },
  { label: "Grand Cayman", value: "grand-cayman" },
  { label: "Mediterranean", value: "mediterranean" },
  { label: "Barcelona", value: "barcelona" },
  { label: "Rome", value: "rome" },
  { label: "Athens", value: "athens" },
  { label: "Santorini", value: "santorini" },
  { label: "Alaska", value: "alaska" },
  { label: "Europe", value: "europe" },
];

interface Product {
  productCode: string;
  title: string;
  description?: string;
  pricing?: { summary: { fromPrice: number } };
  reviews?: { combinedAverageRating: number; totalReviews: number };
  duration?: { fixedDurationInMinutes?: number };
  images?: Array<{ variants: Array<{ url: string; width: number }> }>;
  flags?: string[];
  productUrl?: string;
}

interface ViatorBooking {
  id: string;
  viator_booking_ref: string;
  product_title: string;
  customer_name: string;
  customer_email: string;
  travel_date: string;
  total_price: number;
  status: string;
  created_at: string;
}

async function callViator(body: object) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/viator-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON}`,
      "apikey": SUPABASE_ANON,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

function formatDuration(d: Product["duration"]) {
  if (!d?.fixedDurationInMinutes) return "";
  const h = Math.floor(d.fixedDurationInMinutes / 60);
  const m = d.fixedDurationInMinutes % 60;
  return h > 0 ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// ── Search Tab ────────────────────────────────────────────────────────────────
function SearchTab() {
  const [destination, setDestination] = useState("caribbean");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    const data = await callViator({ action: "search", destination, count: 10 });
    setProducts(data.products || []);
    setTotal(data.totalCount || 0);
    setLoading(false);
  };

  useEffect(() => { search(); }, [destination]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <select
          value={destination}
          onChange={e => setDestination(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3.5 py-2.5 text-[13.5px] text-foreground"
        >
          {PORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Button onClick={search} disabled={loading}>
          {loading ? "..." : "Search"}
        </Button>
      </div>

      {total > 0 && (
        <p className="mb-4 text-[12px] text-muted-foreground tabular-nums">
          {total.toLocaleString()} activities found
        </p>
      )}

      <div className="flex flex-col gap-2">
        {products.map(p => {
          const img = p.images?.[0]?.variants?.find(v => v.width >= 200)?.url;
          const isOpen = expanded === p.productCode;
          return (
            <div key={p.productCode} className="overflow-hidden rounded-md border border-border bg-card">
              <div
                onClick={() => setExpanded(isOpen ? null : p.productCode)}
                className="flex cursor-pointer items-center gap-3.5 px-3.5 py-3 hover:bg-muted/40"
              >
                {img && <img src={img} alt="" className="h-[42px] w-14 flex-shrink-0 rounded object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-[13.5px] font-medium leading-snug text-foreground">{p.title}</div>
                  <div className="flex flex-wrap items-center gap-3 tabular-nums">
                    {p.reviews && (
                      <span className="flex items-center gap-1 text-[11.5px] text-warning">
                        <Star className="h-3 w-3 fill-current" />
                        {p.reviews.combinedAverageRating.toFixed(1)} ({p.reviews.totalReviews.toLocaleString()})
                      </span>
                    )}
                    {p.pricing && (
                      <span className="text-[11.5px] font-bold text-primary">
                        From ${p.pricing.summary.fromPrice.toFixed(2)}
                      </span>
                    )}
                    {formatDuration(p.duration) && (
                      <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(p.duration)}
                      </span>
                    )}
                    {p.flags?.includes("FREE_CANCELLATION") && (
                      <span className="flex items-center gap-1 text-[11px] text-success">
                        <Check className="h-3 w-3" />
                        Free Cancel
                      </span>
                    )}
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
              </div>

              {isOpen && (
                <div className="border-t border-border/60 px-3.5 pb-3.5">
                  {p.description && (
                    <p className="mb-3.5 mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                      {p.description.replace(/<[^>]*>/g, "").slice(0, 300)}...
                    </p>
                  )}
                  <div className="flex items-center gap-2.5">
                    <Button asChild size="sm">
                      <a href={p.productUrl} target="_blank" rel="noopener noreferrer">
                        View on Viator
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(p.productUrl || "")}>
                      Copy Link
                    </Button>
                    <span className="ml-auto self-center text-[11px] text-muted-foreground/70">
                      {p.productCode}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Bookings Tab ──────────────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState<ViatorBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("viator_bookings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setBookings(data || []);
        setLoading(false);
      });
  }, []);

  const statusColor = (s: string) => ({
    CONFIRMED: "hsl(var(--success))",
    PENDING: "hsl(var(--warning))",
    CANCELLED: "hsl(var(--destructive))",
    HELD: "hsl(var(--info))",
    FAILED: "hsl(var(--destructive))",
    AMENDED: "hsl(var(--accent))",
  }[s] || "hsl(var(--muted-foreground))");

  if (loading) return <div className="p-10 text-center text-[13.5px] text-muted-foreground">Loading bookings...</div>;
  if (!bookings.length) return (
    <div className="p-10 text-center">
      <Ticket className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} />
      <p className="text-[13.5px] font-semibold text-foreground">No Viator bookings yet.</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">Bookings made through the website will appear here.</p>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col gap-2">
        {bookings.map(b => (
          <div key={b.id} className="rounded-md border border-border bg-card px-4 py-3.5">
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[13.5px] font-medium text-foreground">{b.product_title || b.viator_booking_ref}</div>
                <div className="text-[12.5px] text-muted-foreground">{b.customer_name} · {b.customer_email}</div>
              </div>
              <span
                className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[.13em]"
                style={{ color: statusColor(b.status), background: `color-mix(in srgb, ${statusColor(b.status)} 15%, transparent)` }}
              >
                {b.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-[12px] text-muted-foreground tabular-nums">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {b.travel_date ? new Date(b.travel_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
              </span>
              {b.total_price && <span className="font-semibold text-primary">${b.total_price.toFixed(2)}</span>}
              <span className="ml-auto">Ref: {b.viator_booking_ref}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function ViatorPanel() {
  const [tab, setTab] = useState<"search" | "bookings">("search");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border/60 bg-primary/5 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Ticket className="h-5 w-5 text-primary" strokeWidth={1.9} />
          <div>
            <div className="text-[14.5px] font-semibold text-foreground">Viator Excursions</div>
            <div className="text-[11px] text-muted-foreground">300,000+ activities worldwide</div>
          </div>
        </div>
        <a
          href="/excursions"
          target="_blank"
          className="text-[10.5px] font-bold uppercase tracking-[.13em] text-primary hover:underline"
        >
          View on Site →
        </a>
      </div>

      <div className="flex border-b border-border/60">
        {(["search", "bookings"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-[11.5px] font-semibold uppercase tracking-[.13em] transition-colors",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "search" ? <Search className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
            {t === "search" ? "Search" : "Bookings"}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "search" ? <SearchTab /> : <BookingsTab />}
      </div>
    </div>
  );
}
