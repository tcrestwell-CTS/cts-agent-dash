"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

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
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <select
          value={destination}
          onChange={e => setDestination(e.target.value)}
          style={{ flex: 1, padding: "10px 14px", background: "#0f1c2e", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontFamily: "sans-serif", fontSize: "0.85rem", borderRadius: 4 }}
        >
          {PORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          onClick={search}
          disabled={loading}
          style={{ padding: "10px 20px", background: "#c9a84c", color: "#0d1b2a", border: "none", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "sans-serif", borderRadius: 4, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {total > 0 && <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>{total.toLocaleString()} activities found</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {products.map(p => {
          const img = p.images?.[0]?.variants?.find(v => v.width >= 200)?.url;
          const isOpen = expanded === p.productCode;
          return (
            <div key={p.productCode} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, overflow: "hidden" }}>
              <div
                onClick={() => setExpanded(isOpen ? null : p.productCode)}
                style={{ display: "flex", gap: 14, padding: "12px 14px", cursor: "pointer", alignItems: "center" }}
              >
                {img && <img src={img} alt="" style={{ width: 56, height: 42, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "white", marginBottom: 4, lineHeight: 1.3 }}>{p.title}</div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {p.reviews && <span style={{ fontSize: "0.72rem", color: "#f59e0b" }}>★ {p.reviews.combinedAverageRating.toFixed(1)} ({p.reviews.totalReviews.toLocaleString()})</span>}
                    {p.pricing && <span style={{ fontSize: "0.72rem", color: "#c9a84c", fontWeight: 700 }}>From ${p.pricing.summary.fromPrice.toFixed(2)}</span>}
                    {formatDuration(p.duration) && <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>⏱ {formatDuration(p.duration)}</span>}
                    {p.flags?.includes("FREE_CANCELLATION") && <span style={{ fontSize: "0.68rem", color: "#4ade80" }}>✓ Free Cancel</span>}
                  </div>
                </div>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
              </div>

              {isOpen && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {p.description && (
                    <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.65, marginBottom: 14, marginTop: 12 }}>
                      {p.description.replace(/<[^>]*>/g, "").slice(0, 300)}...
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <a
                      href={p.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: "8px 16px", background: "#c9a84c", color: "#0d1b2a", textDecoration: "none", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "sans-serif", borderRadius: 3 }}
                    >
                      View on Viator →
                    </a>
                    <button
                      onClick={() => navigator.clipboard?.writeText(p.productUrl || "")}
                      style={{ padding: "8px 16px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "sans-serif", borderRadius: 3 }}
                    >
                      Copy Link
                    </button>
                    <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", alignSelf: "center", marginLeft: "auto" }}>
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
    CONFIRMED: "#4ade80", PENDING: "#f59e0b", CANCELLED: "#f87171",
    HELD: "#60a5fa", FAILED: "#f87171", AMENDED: "#a78bfa",
  }[s] || "#94a3b8");

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>Loading bookings...</div>;
  if (!bookings.length) return (
    <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
      <div style={{ fontSize: "2rem", marginBottom: 12 }}>🎫</div>
      <p style={{ fontSize: "0.85rem" }}>No Viator bookings yet.</p>
      <p style={{ fontSize: "0.78rem", marginTop: 8 }}>Bookings made through the website will appear here.</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {bookings.map(b => (
          <div key={b.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "white", marginBottom: 4 }}>{b.product_title || b.viator_booking_ref}</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.55)" }}>{b.customer_name} · {b.customer_email}</div>
              </div>
              <span style={{ background: `${statusColor(b.status)}22`, border: `1px solid ${statusColor(b.status)}`, color: statusColor(b.status), padding: "3px 10px", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "sans-serif", borderRadius: 3, flexShrink: 0 }}>
                {b.status}
              </span>
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
              <span>📅 {b.travel_date ? new Date(b.travel_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
              {b.total_price && <span style={{ color: "#c9a84c", fontWeight: 600 }}>${b.total_price.toFixed(2)}</span>}
              <span style={{ marginLeft: "auto" }}>Ref: {b.viator_booking_ref}</span>
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
    <div style={{ background: "#0d1b2a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "rgba(201,168,76,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.2rem" }}>🎫</span>
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "white", fontFamily: "sans-serif" }}>Viator Excursions</div>
            <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", fontFamily: "sans-serif", letterSpacing: "0.06em" }}>300,000+ activities worldwide</div>
          </div>
        </div>
        <a
          href="/excursions"
          target="_blank"
          style={{ fontSize: "0.72rem", color: "#c9a84c", textDecoration: "none", fontFamily: "sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          View on Site →
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {(["search", "bookings"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ flex: 1, padding: "12px 0", background: "none", border: "none", borderBottom: tab === t ? "2px solid #c9a84c" : "2px solid transparent", color: tab === t ? "#c9a84c" : "rgba(255,255,255,0.45)", fontFamily: "sans-serif", fontSize: "0.78rem", fontWeight: tab === t ? 700 : 400, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s" }}
          >
            {t === "search" ? "🔍 Search" : "📋 Bookings"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {tab === "search" ? <SearchTab /> : <BookingsTab />}
      </div>
    </div>
  );
}
