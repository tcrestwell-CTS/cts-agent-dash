import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function getDb() {
  return createClient(SUPA_URL, SUPA_KEY);
}

const mcp = new McpServer({ name: "crestwell-travel", version: "1.0.0" });

// ── LEADS ───────────────────────────────────────────────────────

mcp.tool("list_leads", {
  description: "List recent leads/quote requests with AI scores, stages, and contact info.",
  inputSchema: {
    type: "object" as const,
    properties: {
      stage: { type: "string" as const, description: "Filter by ai_stage: Qualified, Quote Needed, Call Needed" },
      status: { type: "string" as const, description: "Filter by status: new, contacted, booked, closed" },
      limit: { type: "number" as const, description: "Max rows (default 25)" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const db = getDb();
    let q = db.from("quote_requests").select("*").order("created_at", { ascending: false }).limit((params.limit as number) || 25);
    if (params.stage) q = q.eq("ai_stage", params.stage as string);
    if (params.status) q = q.eq("status", params.status as string);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("get_lead", {
  description: "Get a single lead by ID with full AI qualification data.",
  inputSchema: {
    type: "object" as const,
    properties: { id: { type: "string" as const, description: "Lead UUID" } },
    required: ["id"],
  },
  handler: async (params: Record<string, unknown>) => {
    const db = getDb();
    const { data, error } = await db.from("quote_requests").select("*").eq("id", params.id as string).single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("update_lead_status", {
  description: "Update a lead's status or add agent notes.",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: { type: "string" as const, description: "Lead UUID" },
      status: { type: "string" as const, description: "new, contacted, booked, closed" },
      agent_notes: { type: "string" as const, description: "Notes to add" },
    },
    required: ["id"],
  },
  handler: async (params: Record<string, unknown>) => {
    const db = getDb();
    const updates: Record<string, unknown> = {};
    if (params.status) updates.status = params.status;
    if (params.agent_notes) updates.agent_notes = params.agent_notes;
    const { data, error } = await db.from("quote_requests").update(updates).eq("id", params.id as string).select().single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: `Updated: ${JSON.stringify(data, null, 2)}` }] };
  },
});

// ── CLIENTS ─────────────────────────────────────────────────────

mcp.tool("list_clients", {
  description: "List CRM clients with name, email, phone, status, tags. Supports search.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Search by name (partial match)" },
      status: { type: "string" as const, description: "Filter by status" },
      limit: { type: "number" as const, description: "Max rows (default 25)" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const db = getDb();
    let q = db.from("clients").select("id, name, first_name, last_name, email, phone, status, tags, location, notes, created_at").order("created_at", { ascending: false }).limit((params.limit as number) || 25);
    if (params.search) q = q.ilike("name", `%${params.search}%`);
    if (params.status) q = q.eq("status", params.status as string);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("get_client", {
  description: "Get full client details by ID including preferences and companions.",
  inputSchema: {
    type: "object" as const,
    properties: { id: { type: "string" as const, description: "Client UUID" } },
    required: ["id"],
  },
  handler: async (params: Record<string, unknown>) => {
    const db = getDb();
    const [clientRes, companionsRes] = await Promise.all([
      db.from("clients").select("*").eq("id", params.id as string).single(),
      db.from("client_companions").select("*").eq("client_id", params.id as string),
    ]);
    if (clientRes.error) return { content: [{ type: "text" as const, text: `Error: ${clientRes.error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ client: clientRes.data, companions: companionsRes.data || [] }, null, 2) }] };
  },
});

// ── TRIPS ───────────────────────────────────────────────────────

mcp.tool("list_trips", {
  description: "List trips with destination, dates, status, and financial totals.",
  inputSchema: {
    type: "object" as const,
    properties: {
      status: { type: "string" as const, description: "Filter by trip status" },
      limit: { type: "number" as const, description: "Max rows (default 25)" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const db = getDb();
    let q = db.from("trips").select("id, trip_name, destination, depart_date, return_date, status, client_id, total_gross_sales, total_commission_revenue, total_net_sales, created_at").order("created_at", { ascending: false }).limit((params.limit as number) || 25);
    if (params.status) q = q.eq("status", params.status as string);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("get_trip", {
  description: "Get full trip details including bookings, itinerary, and payments.",
  inputSchema: {
    type: "object" as const,
    properties: { id: { type: "string" as const, description: "Trip UUID" } },
    required: ["id"],
  },
  handler: async (params: Record<string, unknown>) => {
    const db = getDb();
    const [tripRes, bookingsRes, itineraryRes, paymentsRes] = await Promise.all([
      db.from("trips").select("*").eq("id", params.id as string).single(),
      db.from("bookings").select("*, suppliers(name, supplier_type)").eq("trip_id", params.id as string),
      db.from("itinerary_items").select("*").eq("trip_id", params.id as string).order("day_number").order("sort_order"),
      db.from("trip_payments").select("*").eq("trip_id", params.id as string).order("due_date"),
    ]);
    if (tripRes.error) return { content: [{ type: "text" as const, text: `Error: ${tripRes.error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ trip: tripRes.data, bookings: bookingsRes.data || [], itinerary: itineraryRes.data || [], payments: paymentsRes.data || [] }, null, 2) }] };
  },
});

// ── BOOKINGS ────────────────────────────────────────────────────

mcp.tool("list_bookings", {
  description: "List bookings with confirmation numbers, suppliers, financials, and status.",
  inputSchema: {
    type: "object" as const,
    properties: {
      status: { type: "string" as const, description: "Filter by status" },
      trip_id: { type: "string" as const, description: "Filter by trip ID" },
      limit: { type: "number" as const, description: "Max rows (default 25)" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const db = getDb();
    let q = db.from("bookings").select("id, confirmation_number, status, gross_sales, net_sales, commission_revenue, trip_id, supplier_id, created_at, suppliers(name, supplier_type)").order("created_at", { ascending: false }).limit((params.limit as number) || 25);
    if (params.status) q = q.eq("status", params.status as string);
    if (params.trip_id) q = q.eq("trip_id", params.trip_id as string);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ── SUPPLIERS ───────────────────────────────────────────────────

mcp.tool("list_suppliers", {
  description: "List suppliers with name, type, contact info, and commission rates.",
  inputSchema: {
    type: "object" as const,
    properties: {
      type: { type: "string" as const, description: "Filter by supplier_type" },
      limit: { type: "number" as const, description: "Max rows (default 50)" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const db = getDb();
    let q = db.from("suppliers").select("id, name, supplier_type, contact_name, contact_email, contact_phone, commission_rate, website, notes").order("name").limit((params.limit as number) || 50);
    if (params.type) q = q.eq("supplier_type", params.type as string);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ── COMMISSIONS ─────────────────────────────────────────────────

mcp.tool("list_commissions", {
  description: "List commission records with amounts, rates, and payment status.",
  inputSchema: {
    type: "object" as const,
    properties: {
      status: { type: "string" as const, description: "Filter: pending, paid, cancelled" },
      limit: { type: "number" as const, description: "Max rows (default 25)" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    const db = getDb();
    let q = db.from("commissions").select("*, bookings(confirmation_number, trip_id)").order("created_at", { ascending: false }).limit((params.limit as number) || 25);
    if (params.status) q = q.eq("status", params.status as string);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ── DASHBOARD STATS ─────────────────────────────────────────────

mcp.tool("get_dashboard_stats", {
  description: "Get high-level stats: total clients, trips, bookings, revenue, commissions, and lead pipeline.",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const db = getDb();
    const [clients, trips, bookings, leads] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }),
      db.from("trips").select("id, total_gross_sales, total_commission_revenue").not("status", "eq", "cancelled"),
      db.from("bookings").select("id, gross_sales, commission_revenue, status"),
      db.from("quote_requests").select("id, ai_stage, status").order("created_at", { ascending: false }).limit(100),
    ]);
    const tripData = trips.data || [];
    const bookingData = bookings.data || [];
    const leadData = leads.data || [];
    const stats = {
      total_clients: clients.count || 0,
      total_trips: tripData.length,
      total_bookings: bookingData.length,
      total_revenue: tripData.reduce((s, t) => s + (t.total_gross_sales || 0), 0),
      total_commissions: tripData.reduce((s, t) => s + (t.total_commission_revenue || 0), 0),
      confirmed_bookings: bookingData.filter(b => b.status === "confirmed").length,
      pending_bookings: bookingData.filter(b => b.status === "pending").length,
      leads_total: leadData.length,
      leads_qualified: leadData.filter(l => l.ai_stage === "Qualified").length,
      leads_new: leadData.filter(l => l.status === "new").length,
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
  },
});

// ── TRANSPORT ───────────────────────────────────────────────────

const transport = new StreamableHttpTransport();
const handler = transport.bind(mcp);
const app = new Hono();

app.all("/*", (c) => handler(c.req.raw));

Deno.serve(app.fetch);
