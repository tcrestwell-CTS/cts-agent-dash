import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function getDb() {
  return createClient(SUPA_URL, SUPA_KEY);
}

const mcpServer = new McpServer({
  name: "crestwell-travel",
  version: "1.0.0",
});

// ── LEADS / QUOTE REQUESTS ──────────────────────────────────────

mcpServer.tool({
  name: "list_leads",
  description: "List recent leads/quote requests with AI scores, stages, and contact info. Supports filtering by stage and limit.",
  inputSchema: {
    type: "object",
    properties: {
      stage: { type: "string", description: "Filter by ai_stage: Qualified, Quote Needed, Call Needed, or leave empty for all" },
      limit: { type: "number", description: "Max rows to return (default 25)" },
      status: { type: "string", description: "Filter by status: new, contacted, booked, closed" },
    },
  },
  handler: async ({ stage, limit, status }: { stage?: string; limit?: number; status?: string }) => {
    const db = getDb();
    let q = db.from("quote_requests").select("*").order("created_at", { ascending: false }).limit(limit || 25);
    if (stage) q = q.eq("ai_stage", stage);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_lead",
  description: "Get a single lead/quote request by ID with full details including AI qualification data.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", description: "Lead UUID" } },
    required: ["id"],
  },
  handler: async ({ id }: { id: string }) => {
    const db = getDb();
    const { data, error } = await db.from("quote_requests").select("*").eq("id", id).single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool({
  name: "update_lead_status",
  description: "Update a lead's status (new, contacted, booked, closed) or add agent notes.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Lead UUID" },
      status: { type: "string", description: "New status: new, contacted, booked, closed" },
      agent_notes: { type: "string", description: "Notes to add" },
    },
    required: ["id"],
  },
  handler: async ({ id, status, agent_notes }: { id: string; status?: string; agent_notes?: string }) => {
    const db = getDb();
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (agent_notes) updates.agent_notes = agent_notes;
    const { data, error } = await db.from("quote_requests").update(updates).eq("id", id).select().single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: `Updated lead: ${JSON.stringify(data, null, 2)}` }] };
  },
});

// ── CLIENTS ─────────────────────────────────────────────────────

mcpServer.tool({
  name: "list_clients",
  description: "List CRM clients with name, email, phone, status, and tags. Supports search by name.",
  inputSchema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Search by name (partial match)" },
      status: { type: "string", description: "Filter by status: active, inactive, lead, prospect" },
      limit: { type: "number", description: "Max rows (default 25)" },
    },
  },
  handler: async ({ search, status, limit }: { search?: string; status?: string; limit?: number }) => {
    const db = getDb();
    let q = db.from("clients").select("id, name, first_name, last_name, email, phone, status, tags, location, notes, created_at").order("created_at", { ascending: false }).limit(limit || 25);
    if (search) q = q.ilike("name", `%${search}%`);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_client",
  description: "Get full client details by ID including preferences, companions, and travel history.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", description: "Client UUID" } },
    required: ["id"],
  },
  handler: async ({ id }: { id: string }) => {
    const db = getDb();
    const [clientRes, companionsRes] = await Promise.all([
      db.from("clients").select("*").eq("id", id).single(),
      db.from("client_companions").select("*").eq("client_id", id),
    ]);
    if (clientRes.error) return { content: [{ type: "text", text: `Error: ${clientRes.error.message}` }] };
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ client: clientRes.data, companions: companionsRes.data || [] }, null, 2),
      }],
    };
  },
});

// ── TRIPS ───────────────────────────────────────────────────────

mcpServer.tool({
  name: "list_trips",
  description: "List trips with destination, dates, status, client info, and financial totals.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by trip status (e.g. planning, confirmed, completed, cancelled)" },
      limit: { type: "number", description: "Max rows (default 25)" },
    },
  },
  handler: async ({ status, limit }: { status?: string; limit?: number }) => {
    const db = getDb();
    let q = db.from("trips").select("id, trip_name, destination, depart_date, return_date, status, client_id, total_gross_sales, total_commission_revenue, total_net_sales, created_at").order("created_at", { ascending: false }).limit(limit || 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_trip",
  description: "Get full trip details including bookings, itinerary items, and payments.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", description: "Trip UUID" } },
    required: ["id"],
  },
  handler: async ({ id }: { id: string }) => {
    const db = getDb();
    const [tripRes, bookingsRes, itineraryRes, paymentsRes] = await Promise.all([
      db.from("trips").select("*").eq("id", id).single(),
      db.from("bookings").select("*, suppliers(name, supplier_type)").eq("trip_id", id),
      db.from("itinerary_items").select("*").eq("trip_id", id).order("day_number").order("sort_order"),
      db.from("trip_payments").select("*").eq("trip_id", id).order("due_date"),
    ]);
    if (tripRes.error) return { content: [{ type: "text", text: `Error: ${tripRes.error.message}` }] };
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          trip: tripRes.data,
          bookings: bookingsRes.data || [],
          itinerary: itineraryRes.data || [],
          payments: paymentsRes.data || [],
        }, null, 2),
      }],
    };
  },
});

// ── BOOKINGS ────────────────────────────────────────────────────

mcpServer.tool({
  name: "list_bookings",
  description: "List bookings with confirmation numbers, suppliers, financials, and status.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by status (e.g. confirmed, pending, cancelled)" },
      trip_id: { type: "string", description: "Filter by trip ID" },
      limit: { type: "number", description: "Max rows (default 25)" },
    },
  },
  handler: async ({ status, trip_id, limit }: { status?: string; trip_id?: string; limit?: number }) => {
    const db = getDb();
    let q = db.from("bookings").select("id, confirmation_number, status, gross_sales, net_sales, commission_revenue, commissionable_amount, trip_id, supplier_id, created_at, suppliers(name, supplier_type)").order("created_at", { ascending: false }).limit(limit || 25);
    if (status) q = q.eq("status", status);
    if (trip_id) q = q.eq("trip_id", trip_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── SUPPLIERS ───────────────────────────────────────────────────

mcpServer.tool({
  name: "list_suppliers",
  description: "List suppliers with name, type, contact info, and commission rates.",
  inputSchema: {
    type: "object",
    properties: {
      type: { type: "string", description: "Filter by supplier_type (e.g. hotel, airline, cruise, tour)" },
      limit: { type: "number", description: "Max rows (default 50)" },
    },
  },
  handler: async ({ type, limit }: { type?: string; limit?: number }) => {
    const db = getDb();
    let q = db.from("suppliers").select("id, name, supplier_type, contact_name, contact_email, contact_phone, commission_rate, website, notes").order("name").limit(limit || 50);
    if (type) q = q.eq("supplier_type", type);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── COMMISSIONS ─────────────────────────────────────────────────

mcpServer.tool({
  name: "list_commissions",
  description: "List commission records with amounts, rates, and payment status.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by status: pending, paid, cancelled" },
      limit: { type: "number", description: "Max rows (default 25)" },
    },
  },
  handler: async ({ status, limit }: { status?: string; limit?: number }) => {
    const db = getDb();
    let q = db.from("commissions").select("*, bookings(confirmation_number, trip_id)").order("created_at", { ascending: false }).limit(limit || 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ── ANALYTICS / DASHBOARD ───────────────────────────────────────

mcpServer.tool({
  name: "get_dashboard_stats",
  description: "Get high-level dashboard statistics: total clients, trips, bookings, revenue, and commission totals.",
  inputSchema: { type: "object", properties: {} },
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

    return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
  },
});

// ── TRANSPORT ───────────────────────────────────────────────────

const transport = new StreamableHttpTransport();
const app = new Hono();

app.all("/*", async (c) => {
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
