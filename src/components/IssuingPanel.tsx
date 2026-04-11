"use client";
import { useState, useEffect } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const AGENT_SECRET = "crestwell-agent-2024";

interface IssuedCard {
  id: string;
  stripe_card_id: string;
  booking_ref: string;
  trip_name: string;
  agent_name: string;
  agent_email: string;
  supplier_name: string;
  supplier_category: string;
  purpose: string;
  spend_limit_cents: number;
  amount_spent_cents: number;
  status: "active" | "used" | "cancelled" | "expired";
  expires_at: string;
  created_at: string;
  transaction_count: number;
}

interface NewCardForm {
  agent_name: string;
  agent_email: string;
  spend_limit: string;
  booking_ref: string;
  trip_name: string;
  supplier_name: string;
  supplier_category: string;
  purpose: string;
}

interface CardReveal {
  number: string;
  cvc: string;
  exp_month: number;
  exp_year: number;
  last4: string;
}

async function callIssuing(action: string, params: object = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-issuing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON}`,
      "apikey": SUPABASE_ANON,
      "x-agent-secret": AGENT_SECRET,
    },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

function statusColor(s: string) {
  return { active: "#4ade80", used: "#c9a84c", cancelled: "#f87171", expired: "#94a3b8" }[s] || "#94a3b8";
}

const SUPPLIER_CATEGORIES = [
  "cruise_line", "hotel_resort", "tour_operator",
  "airline", "transfer", "excursion", "insurance", "other",
];

// ── Issue Card Form ────────────────────────────────────────────────────────────
function IssueCardForm({ onIssued }: { onIssued: (card: CardReveal & { card_id: string }) => void }) {
  const [form, setForm] = useState<NewCardForm>({
    agent_name: "", agent_email: "", spend_limit: "",
    booking_ref: "", trip_name: "", supplier_name: "",
    supplier_category: "cruise_line", purpose: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof NewCardForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.agent_name || !form.agent_email || !form.spend_limit) {
      setError("Agent name, email, and spend limit are required");
      return;
    }
    const cents = Math.round(parseFloat(form.spend_limit.replace(/[^0-9.]/g, "")) * 100);
    if (isNaN(cents) || cents < 100) {
      setError("Spend limit must be at least $1.00");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await callIssuing("create_card", {
        agent_name:        form.agent_name,
        agent_email:       form.agent_email,
        spend_limit_cents: cents,
        booking_ref:       form.booking_ref,
        trip_name:         form.trip_name,
        supplier_name:     form.supplier_name,
        supplier_category: form.supplier_category,
        purpose:           form.purpose,
      });
      if (data.error) throw new Error(JSON.stringify(data.error));
      onIssued({ ...data, card_id: data.card_id });
    } catch (e: any) {
      setError(e.message || "Failed to issue card");
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)", color: "white",
    fontFamily: "sans-serif", fontSize: "0.83rem", borderRadius: 4,
    boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.65rem", letterSpacing: "0.1em",
    textTransform: "uppercase", color: "rgba(255,255,255,0.45)",
    marginBottom: 5, fontFamily: "sans-serif",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Agent Name *</label>
          <input value={form.agent_name} onChange={e => set("agent_name", e.target.value)}
            placeholder="Tim Crestwell" style={inp} />
        </div>
        <div>
          <label style={lbl}>Agent Email *</label>
          <input type="email" value={form.agent_email} onChange={e => set("agent_email", e.target.value)}
            placeholder="tim@crestwellgetaways.com" style={inp} />
        </div>
      </div>

      <div>
        <label style={lbl}>Spend Limit (exact amount to authorize) *</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#c9a84c", fontWeight: 700 }}>$</span>
          <input value={form.spend_limit} onChange={e => set("spend_limit", e.target.value)}
            placeholder="2,500.00" style={{ ...inp, paddingLeft: 24, fontFamily: "monospace", fontSize: "1rem", color: "#c9a84c" }} />
        </div>
        <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
          Card will be cancelled automatically once this amount is spent or after 30 days.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Booking Ref</label>
          <input value={form.booking_ref} onChange={e => set("booking_ref", e.target.value)}
            placeholder="CTS-2024-001" style={inp} />
        </div>
        <div>
          <label style={lbl}>Trip Name</label>
          <input value={form.trip_name} onChange={e => set("trip_name", e.target.value)}
            placeholder="Caribbean Cruise — Smith Family" style={inp} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Supplier Name</label>
          <input value={form.supplier_name} onChange={e => set("supplier_name", e.target.value)}
            placeholder="Royal Caribbean" style={inp} />
        </div>
        <div>
          <label style={lbl}>Supplier Category</label>
          <select value={form.supplier_category} onChange={e => set("supplier_category", e.target.value)}
            style={{ ...inp, cursor: "pointer" }}>
            {SUPPLIER_CATEGORIES.map(c => (
              <option key={c} value={c}>{c.replace(/_/g, " ").replace(/\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={lbl}>Purpose / Notes</label>
        <input value={form.purpose} onChange={e => set("purpose", e.target.value)}
          placeholder="Final payment — cabin booking for Smith Family cruise" style={inp} />
      </div>

      {error && (
        <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", padding: "10px 14px", borderRadius: 4, fontSize: "0.8rem", color: "#f87171" }}>
          {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading}
        style={{ padding: "12px", background: loading ? "rgba(201,168,76,0.4)" : "#c9a84c", color: "#0d1b2a", border: "none", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.1em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", borderRadius: 4, fontFamily: "sans-serif" }}>
        {loading ? "Issuing Card…" : "🪙 Issue Virtual Card"}
      </button>
    </div>
  );
}

// ── Card Reveal Modal ─────────────────────────────────────────────────────────
function CardRevealModal({ card, onClose }: { card: CardReveal & { card_id: string }; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showCVC, setShowCVC] = useState(false);

  const copy = (val: string, label: string) => {
    navigator.clipboard?.writeText(val);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const fmt = (n: string) => n.replace(/(\d{4})/g, "$1 ").trim();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#0d1b2a", border: "1px solid rgba(201,168,76,0.4)", borderRadius: 12, maxWidth: 480, width: "100%", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#c9a84c", marginBottom: 4 }}>Virtual Card Issued</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "white" }}>Share with Agent Securely</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>

        {/* Card visual */}
        <div style={{ background: "linear-gradient(135deg, #1a3a5c, #0d1b2a)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 10, padding: "24px 24px 20px", marginBottom: 20, position: "relative" }}>
          <div style={{ fontSize: "0.62rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 20 }}>Crestwell Travel Services</div>
          <div style={{ fontFamily: "monospace", fontSize: "1.3rem", color: "white", letterSpacing: "0.15em", marginBottom: 20 }}>
            {card.number ? fmt(card.number) : `•••• •••• •••• ${card.last4}`}
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <div style={{ fontSize: "0.55rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Expires</div>
              <div style={{ fontFamily: "monospace", color: "white", fontSize: "0.9rem" }}>
                {String(card.exp_month).padStart(2, "0")}/{String(card.exp_year).slice(-2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.55rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>CVC</div>
              <div style={{ fontFamily: "monospace", color: "white", fontSize: "0.9rem", cursor: "pointer" }} onClick={() => setShowCVC(!showCVC)}>
                {showCVC ? card.cvc : "•••"}
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 16, right: 16, fontSize: "0.65rem", color: "#c9a84c", fontWeight: 700, letterSpacing: "0.1em" }}>VIRTUAL</div>
        </div>

        {/* Copy buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {card.number && (
            <button onClick={() => copy(card.number, "number")}
              style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: copied === "number" ? "#4ade80" : "white", cursor: "pointer", fontFamily: "monospace", fontSize: "0.82rem" }}>
              <span>{fmt(card.number)}</span>
              <span style={{ fontSize: "0.7rem" }}>{copied === "number" ? "✓ Copied" : "Copy"}</span>
            </button>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => copy(card.cvc, "cvc")}
              style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: copied === "cvc" ? "#4ade80" : "white", cursor: "pointer", fontFamily: "monospace", fontSize: "0.82rem" }}>
              <span>CVC: {card.cvc}</span>
              <span style={{ fontSize: "0.7rem" }}>{copied === "cvc" ? "✓" : "Copy"}</span>
            </button>
            <button onClick={() => copy(`${String(card.exp_month).padStart(2,"0")}/${card.exp_year}`, "exp")}
              style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: copied === "exp" ? "#4ade80" : "white", cursor: "pointer", fontFamily: "monospace", fontSize: "0.82rem" }}>
              <span>{String(card.exp_month).padStart(2,"0")}/{card.exp_year}</span>
              <span style={{ fontSize: "0.7rem" }}>{copied === "exp" ? "✓" : "Copy"}</span>
            </button>
          </div>
        </div>

        <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "10px 14px", fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          ⚠️ Card number is only shown once. Copy and share securely — do not send via email. Card expires in 30 days or when the spend limit is reached.
        </div>

        <button onClick={onClose}
          style={{ width: "100%", marginTop: 16, padding: "11px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", borderRadius: 6, cursor: "pointer", fontFamily: "sans-serif", fontSize: "0.8rem" }}>
          Done — I've Saved the Card Details
        </button>
      </div>
    </div>
  );
}

// ── Cards List ────────────────────────────────────────────────────────────────
function CardsList({ refresh }: { refresh: number }) {
  const [cards, setCards] = useState<IssuedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Record<string, any[]>>({});

  useEffect(() => {
    callIssuing("list_cards").then(d => {
      setCards(d.cards || []);
      setLoading(false);
    });
  }, [refresh]);

  const cancelCard = async (cardId: string, stripeId: string) => {
    if (!confirm("Cancel this card? This cannot be undone.")) return;
    setCancellingId(cardId);
    await callIssuing("cancel_card", { stripe_card_id: stripeId, reason: "Agent cancelled" });
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: "cancelled" as const } : c));
    setCancellingId(null);
  };

  const loadTransactions = async (stripeId: string) => {
    if (transactions[stripeId]) { setExpandedId(expandedId === stripeId ? null : stripeId); return; }
    const data = await callIssuing("get_transactions", { stripe_card_id: stripeId });
    setTransactions(prev => ({ ...prev, [stripeId]: data.transactions || [] }));
    setExpandedId(stripeId);
  };

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>Loading cards…</div>;

  if (!cards.length) return (
    <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🪙</div>
      <p style={{ fontSize: "0.85rem" }}>No cards issued yet.</p>
      <p style={{ fontSize: "0.75rem", marginTop: 6 }}>Issue a card above to pay a supplier.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {cards.map(card => {
        const pct = card.spend_limit_cents > 0 ? Math.min(100, (card.amount_spent_cents / card.spend_limit_cents) * 100) : 0;
        const isExpanded = expandedId === card.stripe_card_id;
        const txns = transactions[card.stripe_card_id] || [];

        return (
          <div key={card.id} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${card.status === "active" ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.07)"}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "white", marginBottom: 3 }}>
                    {card.trip_name || card.booking_ref || "Unnamed Trip"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                    {card.supplier_name || "No supplier"} · {card.agent_name} · ••••{card.stripe_card_id.slice(-4)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ background: `${statusColor(card.status)}22`, border: `1px solid ${statusColor(card.status)}55`, color: statusColor(card.status), padding: "2px 8px", borderRadius: 3, fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {card.status}
                  </span>
                </div>
              </div>

              {/* Spend bar */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", marginBottom: 5 }}>
                  <span>Spent: {formatCents(card.amount_spent_cents)}</span>
                  <span>Limit: {formatCents(card.spend_limit_cents)}</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct > 90 ? "#f87171" : "#c9a84c", borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>
                  {timeLeft(card.expires_at)} · {new Date(card.created_at).toLocaleDateString()}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => loadTransactions(card.stripe_card_id)}
                    style={{ padding: "5px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", borderRadius: 4, fontSize: "0.68rem", cursor: "pointer", fontFamily: "sans-serif" }}>
                    {isExpanded ? "Hide" : "Transactions"}
                  </button>
                  {card.status === "active" && (
                    <button onClick={() => cancelCard(card.id, card.stripe_card_id)} disabled={cancellingId === card.id}
                      style={{ padding: "5px 10px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", borderRadius: 4, fontSize: "0.68rem", cursor: "pointer", fontFamily: "sans-serif" }}>
                      {cancellingId === card.id ? "…" : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Transactions */}
            {isExpanded && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px", background: "rgba(0,0,0,0.2)" }}>
                {txns.length === 0
                  ? <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>No transactions yet.</p>
                  : txns.map((t: any) => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "0.75rem" }}>
                      <span style={{ color: "rgba(255,255,255,0.6)" }}>{t.merchant_data?.name || "Unknown merchant"}</span>
                      <span style={{ color: "#c9a84c", fontWeight: 600 }}>{formatCents(Math.abs(t.amount))}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function IssuingPanel() {
  const [tab, setTab] = useState<"issue" | "cards">("issue");
  const [revealCard, setRevealCard] = useState<(CardReveal & { card_id: string }) | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleIssued = (card: CardReveal & { card_id: string }) => {
    setRevealCard(card);
    setRefreshKey(k => k + 1);
    setTab("cards");
  };

  return (
    <div style={{ background: "#0d1b2a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "rgba(201,168,76,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.2rem" }}>🪙</span>
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "white", fontFamily: "sans-serif" }}>Agent Payment Cards</div>
            <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", fontFamily: "sans-serif", letterSpacing: "0.06em" }}>
              Stripe Issuing · Single-use virtual · 30-day expiry
            </div>
          </div>
        </div>
        <div style={{ fontSize: "0.65rem", color: "#c9a84c", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", padding: "4px 10px", borderRadius: 20, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "sans-serif" }}>
          SANDBOX
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {([["issue", "🪙 Issue New Card"], ["cards", "📋 Active Cards"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: "12px 0", background: "none", border: "none", borderBottom: tab === t ? "2px solid #c9a84c" : "2px solid transparent", color: tab === t ? "#c9a84c" : "rgba(255,255,255,0.45)", fontFamily: "sans-serif", fontSize: "0.78rem", fontWeight: tab === t ? 700 : 400, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>
        {tab === "issue" && <IssueCardForm onIssued={handleIssued} />}
        {tab === "cards" && <CardsList refresh={refreshKey} />}
      </div>

      {revealCard && <CardRevealModal card={revealCard} onClose={() => setRevealCard(null)} />}
    </div>
  );
}
