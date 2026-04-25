import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_ROWS = 5000;

// ---------- CSV parsing (handles quoted fields, commas, CRLF, Tern preamble) ----------
function parseCSV(text: string): Record<string, string>[] {
  // Strip BOM
  text = text.replace(/^\uFEFF/, "");
  // Tokenize into rows of fields
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* swallow */ }
      else { field += c; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  // Find header row: the first row that contains > 3 non-empty fields and looks like headers
  // Tern preamble lines start with "Data extract" or are filter descriptions or blank
  let headerIdx = 0;
  for (let i = 0; i < rows.length; i++) {
    const nonEmpty = rows[i].filter((v) => v && v.trim()).length;
    if (nonEmpty >= 3 && !/^Data extract/i.test(rows[i][0]) && !/^Filters applied/i.test(rows[i][0]) && !/=/.test(rows[i][0]?.split(":")[0] ?? "") ) {
      headerIdx = i; break;
    }
  }
  const headers = rows[headerIdx].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((v) => !v || !v.trim())) continue; // skip empty
    const rec: Record<string, string> = {};
    headers.forEach((h, j) => { rec[h] = (r[j] ?? "").trim(); });
    out.push(rec);
  }
  return out;
}

// ---------- Helpers ----------
function normName(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}
function normConf(s: string | null | undefined): string {
  return (s ?? "").toString().trim().replace(/^'+/, "").trim();
}
function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  const cleaned = s.toString().replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}
function parseDateAny(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // MM/DD/YYYY
  const m1 = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const [, mm, dd, yyyy] = m1;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // MM-DD-YYYY
  const m2 = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) {
    const [, mm, dd, yyyy] = m2;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}
function extractTripUrl(raw: string | undefined): { url: string | null; ternId: string | null } {
  if (!raw) return { url: null, ternId: null };
  const m = raw.match(/https?:\/\/[^\s"]+/);
  const url = m ? m[0] : null;
  const idM = url?.match(/\/trips\/(\d+)/);
  return { url, ternId: idM ? idM[1] : null };
}
function extractBookingId(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/\/bookings\/(\d+)/);
  return m ? m[1] : null;
}
function mapTripStatus(s: string | undefined): string {
  const v = (s ?? "").toLowerCase().trim();
  if (v === "booked") return "booked";
  if (v === "planning") return "planning";
  if (v === "inbound") return "planning";
  if (v === "archived") return "archived";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  if (v === "completed") return "completed";
  return "planning";
}
function mapBookingStatusFromCommission(commissionStatus: string | undefined): string {
  const v = (commissionStatus ?? "").toLowerCase().trim();
  if (v === "received") return "completed";
  if (v === "overdue") return "confirmed";
  if (v === "expected" || v === "pending") return "confirmed";
  if (v === "void" || v === "cancelled") return "cancelled";
  return "confirmed";
}
function splitName(full: string): { first: string | null; last: string | null } {
  const t = full.trim();
  if (!t) return { first: null, last: null };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}
function isValidContact(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = name.trim().replace(/^'+/, "");
  return n.length > 1 && n !== "--" && n !== "-";
}

// ---------- Types ----------
interface TripRow {
  trip_name: string;
  trip_page_url: string | null;
  tern_trip_id: string | null;
  status: string;
  depart_date: string | null;
  return_date: string | null;
  client_name: string | null;
  advisor: string | null;
  gross_sale: number;
  currency: string;
}
interface BookingRow {
  supplier_name: string;
  booking_page_url: string | null;
  tern_booking_id: string | null;
  client_name: string;
  start_date: string | null;
  confirmation_number: string;
  agent: string | null;
  agency: string | null;
  commission_status: string;
  booking_date: string | null;
  gross_sale: number;
  expected_commission: number;
  expected_agency_income: number;
  received_commission: number;
  received_agency_income: number;
}

function parseTripsCsv(rows: Record<string, string>[]): TripRow[] {
  return rows
    .map((r) => {
      const tripName = r["Trip Name"]?.trim();
      if (!tripName) return null;
      const { url, ternId } = extractTripUrl(r["Trip Page"]);
      const contact = r["Primary Contact Full Name"] || r["Primary Contact"];
      return {
        trip_name: tripName,
        trip_page_url: url,
        tern_trip_id: ternId,
        status: mapTripStatus(r["Status"]),
        depart_date: parseDateAny(r["Start Date"]),
        return_date: parseDateAny(r["End Date"]),
        client_name: isValidContact(contact) ? contact!.replace(/^'+/, "").trim() : null,
        advisor: r["Advisor Full Name"] || r["Owner Agent"] || null,
        gross_sale: parseAmount(r["Gross Sale Amount (Your Currency)"]),
        currency: r["Your Currency"] || "USD",
      } as TripRow;
    })
    .filter((x): x is TripRow => x !== null);
}

function parseBookingsCsv(rows: Record<string, string>[]): BookingRow[] {
  return rows
    .map((r) => {
      const supplier = r["Supplier Name"]?.trim();
      const conf = normConf(r["Conf. #"] || r["Confirmation"]);
      const client = r["Client"]?.trim();
      if (!supplier || !conf || !client) return null;
      return {
        supplier_name: supplier,
        booking_page_url: extractTripUrl(r["Booking Page"]).url,
        tern_booking_id: extractBookingId(r["Booking Page"]),
        client_name: client.replace(/^'+/, "").trim(),
        start_date: parseDateAny(r["Start Date"]),
        confirmation_number: conf,
        agent: r["Agent"] || null,
        agency: r["Direct Agency"] || null,
        commission_status: r["Commission Status"] || "",
        booking_date: parseDateAny(r["Booking Date"]),
        gross_sale: parseAmount(r["Gross Sale"]),
        expected_commission: parseAmount(r["Exp. Commission"]),
        expected_agency_income: parseAmount(r["Exp. Agency Income"]),
        received_commission: parseAmount(r["Rcvd. Commission"]),
        received_agency_income: parseAmount(r["Rcvd. Agency Income"]),
      } as BookingRow;
    })
    .filter((x): x is BookingRow => x !== null);
}

// ---------- Plan ----------
interface Plan {
  clients: { create: { name: string; first_name: string | null; last_name: string | null }[]; reuse: number };
  suppliers: { create: { name: string }[]; reuse: number };
  trips: { create: number; update: number; reuse: number };
  bookings: { create: number; duplicate: number };
  warnings: string[];
  unmatchedBookings: { confirmation_number: string; client_name: string; supplier_name: string; reason: string }[];
}

async function buildPlan(
  supabase: SupabaseClient,
  userId: string,
  trips: TripRow[],
  bookings: BookingRow[],
) {
  // Fetch existing
  const [{ data: existingClients }, { data: existingSuppliers }, { data: existingTrips }, { data: existingBookings }] =
    await Promise.all([
      supabase.from("clients").select("id, name, first_name, last_name, email").eq("user_id", userId),
      supabase.from("suppliers").select("id, name").eq("user_id", userId),
      supabase.from("trips").select("id, trip_name, client_id, trip_page_url").eq("user_id", userId),
      supabase.from("bookings").select("id, confirmation_number").eq("user_id", userId),
    ]);

  const clientByName = new Map<string, { id: string }>();
  for (const c of existingClients || []) {
    clientByName.set(normName(c.name), { id: c.id });
    if (c.first_name && c.last_name) {
      clientByName.set(normName(`${c.first_name} ${c.last_name}`), { id: c.id });
    }
  }
  const supplierByName = new Map<string, { id: string }>();
  for (const s of existingSuppliers || []) supplierByName.set(normName(s.name), { id: s.id });

  const tripByName = new Map<string, { id: string }>();
  for (const t of existingTrips || []) tripByName.set(normName(t.trip_name), { id: t.id });

  const bookingByConf = new Set<string>();
  for (const b of existingBookings || []) bookingByConf.add(normConf(b.confirmation_number));

  // Collect unique client names to create
  const neededClients = new Map<string, { name: string; first: string | null; last: string | null }>();
  for (const t of trips) {
    if (t.client_name) {
      const key = normName(t.client_name);
      if (!clientByName.has(key) && !neededClients.has(key)) {
        const { first, last } = splitName(t.client_name);
        neededClients.set(key, { name: t.client_name, first, last });
      }
    }
  }
  for (const b of bookings) {
    const key = normName(b.client_name);
    if (!clientByName.has(key) && !neededClients.has(key)) {
      const { first, last } = splitName(b.client_name);
      neededClients.set(key, { name: b.client_name, first, last });
    }
  }

  // Collect unique suppliers to create
  const neededSuppliers = new Map<string, { name: string }>();
  for (const b of bookings) {
    const key = normName(b.supplier_name);
    if (!supplierByName.has(key) && !neededSuppliers.has(key)) {
      neededSuppliers.set(key, { name: b.supplier_name });
    }
  }

  // Trips: dedupe by trip_name
  let tripsCreate = 0;
  let tripsReuse = 0;
  for (const t of trips) {
    const key = normName(t.trip_name);
    if (tripByName.has(key)) tripsReuse++;
    else tripsCreate++;
  }

  // Bookings: dedupe by confirmation_number
  let bookingsCreate = 0;
  let bookingsDuplicate = 0;
  const unmatched: Plan["unmatchedBookings"] = [];
  const seenConfInThisFile = new Set<string>();
  for (const b of bookings) {
    const conf = normConf(b.confirmation_number);
    if (bookingByConf.has(conf) || seenConfInThisFile.has(conf)) {
      bookingsDuplicate++;
      continue;
    }
    seenConfInThisFile.add(conf);
    bookingsCreate++;
  }

  const plan: Plan = {
    clients: {
      create: Array.from(neededClients.values()).map((c) => ({ name: c.name, first_name: c.first, last_name: c.last })),
      reuse: (existingClients?.length ?? 0),
    },
    suppliers: {
      create: Array.from(neededSuppliers.values()).map((s) => ({ name: s.name })),
      reuse: (existingSuppliers?.length ?? 0),
    },
    trips: { create: tripsCreate, update: 0, reuse: tripsReuse },
    bookings: { create: bookingsCreate, duplicate: bookingsDuplicate },
    warnings: [],
    unmatchedBookings: unmatched,
  };
  return plan;
}

// ---------- Commit ----------
async function commit(
  supabase: SupabaseClient,
  userId: string,
  trips: TripRow[],
  bookings: BookingRow[],
) {
  // Re-fetch for fresh maps
  const [{ data: existingClients }, { data: existingSuppliers }, { data: existingTrips }, { data: existingBookings }] =
    await Promise.all([
      supabase.from("clients").select("id, name, first_name, last_name").eq("user_id", userId),
      supabase.from("suppliers").select("id, name").eq("user_id", userId),
      supabase.from("trips").select("id, trip_name").eq("user_id", userId),
      supabase.from("bookings").select("id, confirmation_number").eq("user_id", userId),
    ]);

  const clientByName = new Map<string, string>();
  for (const c of existingClients || []) {
    clientByName.set(normName(c.name), c.id);
    if (c.first_name && c.last_name) clientByName.set(normName(`${c.first_name} ${c.last_name}`), c.id);
  }
  const supplierByName = new Map<string, string>();
  for (const s of existingSuppliers || []) supplierByName.set(normName(s.name), s.id);
  const tripByName = new Map<string, string>();
  for (const t of existingTrips || []) tripByName.set(normName(t.trip_name), t.id);
  const existingConf = new Set<string>();
  for (const b of existingBookings || []) existingConf.add(normConf(b.confirmation_number));

  const result = {
    clientsCreated: 0,
    suppliersCreated: 0,
    tripsCreated: 0,
    bookingsCreated: 0,
    bookingsSkipped: 0,
    errors: [] as string[],
  };

  // 1) Create missing clients (collect uniques across both files)
  const clientNeeds = new Map<string, { name: string; first: string | null; last: string | null }>();
  const collect = (name: string | null | undefined) => {
    if (!name) return;
    const key = normName(name);
    if (!clientByName.has(key) && !clientNeeds.has(key)) {
      const { first, last } = splitName(name);
      clientNeeds.set(key, { name, first, last });
    }
  };
  for (const t of trips) collect(t.client_name);
  for (const b of bookings) collect(b.client_name);

  if (clientNeeds.size > 0) {
    const rows = Array.from(clientNeeds.values()).map((c) => ({
      user_id: userId,
      name: c.name,
      first_name: c.first,
      last_name: c.last,
      status: "active",
      notes: "Imported from Tern.travel",
    }));
    const { data, error } = await supabase.from("clients").insert(rows).select("id, name, first_name, last_name");
    if (error) result.errors.push(`Clients: ${error.message}`);
    else {
      for (const c of data || []) {
        clientByName.set(normName(c.name), c.id);
        if (c.first_name && c.last_name) clientByName.set(normName(`${c.first_name} ${c.last_name}`), c.id);
      }
      result.clientsCreated = data?.length ?? 0;
    }
  }

  // 2) Create missing suppliers
  const supplierNeeds = new Map<string, string>();
  for (const b of bookings) {
    const key = normName(b.supplier_name);
    if (!supplierByName.has(key) && !supplierNeeds.has(key)) supplierNeeds.set(key, b.supplier_name);
  }
  if (supplierNeeds.size > 0) {
    const rows = Array.from(supplierNeeds.values()).map((name) => ({
      user_id: userId,
      name,
      supplier_type: /cruise/i.test(name) ? "cruise_line" : /airlin|airway/i.test(name) ? "airline" : /hotel|resort|inn/i.test(name) ? "hotel" : "other",
      notes: "Imported from Tern.travel",
    }));
    const { data, error } = await supabase.from("suppliers").insert(rows).select("id, name");
    if (error) result.errors.push(`Suppliers: ${error.message}`);
    else {
      for (const s of data || []) supplierByName.set(normName(s.name), s.id);
      result.suppliersCreated = data?.length ?? 0;
    }
  }

  // 3) Create missing trips
  const tripsToCreate: Array<{ key: string; row: Record<string, unknown> }> = [];
  for (const t of trips) {
    const key = normName(t.trip_name);
    if (tripByName.has(key)) continue;
    const clientId = t.client_name ? clientByName.get(normName(t.client_name)) ?? null : null;
    tripsToCreate.push({
      key,
      row: {
        user_id: userId,
        client_id: clientId,
        trip_name: t.trip_name,
        destination: t.trip_name,
        status: t.status,
        depart_date: t.depart_date,
        return_date: t.return_date,
        trip_page_url: t.trip_page_url,
        currency: t.currency || "USD",
        notes: `Imported from Tern.travel${t.tern_trip_id ? ` (Tern ID: ${t.tern_trip_id})` : ""}${t.advisor ? ` · Advisor: ${t.advisor}` : ""}`,
      },
    });
  }
  if (tripsToCreate.length > 0) {
    const { data, error } = await supabase.from("trips").insert(tripsToCreate.map((t) => t.row)).select("id, trip_name");
    if (error) result.errors.push(`Trips: ${error.message}`);
    else {
      for (const t of data || []) tripByName.set(normName(t.trip_name), t.id);
      result.tripsCreated = data?.length ?? 0;
    }
  }

  // 4) Create bookings, joining to trip by client name + nearest start date
  // Build trip lookup: by client_id for join fallback
  const { data: tripsForJoin } = await supabase
    .from("trips")
    .select("id, trip_name, client_id, depart_date, return_date")
    .eq("user_id", userId);

  const tripsByClient = new Map<string, Array<{ id: string; depart_date: string | null; return_date: string | null; trip_name: string }>>();
  for (const t of tripsForJoin || []) {
    if (!t.client_id) continue;
    const arr = tripsByClient.get(t.client_id) ?? [];
    arr.push({ id: t.id, depart_date: t.depart_date, return_date: t.return_date, trip_name: t.trip_name });
    tripsByClient.set(t.client_id, arr);
  }

  for (const b of bookings) {
    const conf = normConf(b.confirmation_number);
    if (existingConf.has(conf)) { result.bookingsSkipped++; continue; }

    const supplierId = supplierByName.get(normName(b.supplier_name));
    if (!supplierId) { result.errors.push(`Supplier missing for ${b.supplier_name}`); continue; }

    const clientId = clientByName.get(normName(b.client_name));
    if (!clientId) { result.errors.push(`Client missing for ${b.client_name}`); continue; }

    // Find best trip for this booking: same client_id, booking start_date within trip range
    let tripId: string | null = null;
    const candidateTrips = tripsByClient.get(clientId) ?? [];
    if (b.start_date && candidateTrips.length) {
      const target = new Date(b.start_date).getTime();
      let best: { id: string; score: number } | null = null;
      for (const ct of candidateTrips) {
        if (!ct.depart_date) continue;
        const dStart = new Date(ct.depart_date).getTime();
        const dEnd = ct.return_date ? new Date(ct.return_date).getTime() : dStart;
        let score = Number.MAX_SAFE_INTEGER;
        if (target >= dStart && target <= dEnd) score = 0;
        else score = Math.min(Math.abs(target - dStart), Math.abs(target - dEnd));
        if (!best || score < best.score) best = { id: ct.id, score };
      }
      if (best && best.score < 1000 * 60 * 60 * 24 * 30) tripId = best.id; // within 30 days
    } else if (candidateTrips.length === 1) {
      tripId = candidateTrips[0].id;
    }

    const grossSales = b.gross_sale;
    const commissionRevenue = b.received_commission > 0 ? b.received_commission : b.expected_commission;
    const supplierPayout = Math.max(grossSales - commissionRevenue, 0);
    const status = mapBookingStatusFromCommission(b.commission_status);

    const insertRow = {
      user_id: userId,
      supplier_id: supplierId,
      trip_id: tripId,
      confirmation_number: conf,
      status,
      total_price: grossSales,
      gross_sales: grossSales,
      commissionable_amount: grossSales,
      commission_revenue: commissionRevenue,
      net_sales: grossSales - supplierPayout,
      calculated_commission: commissionRevenue,
      supplier_payout: supplierPayout,
      pricing_mode: "commission",
    };

    const { error } = await supabase.from("bookings").insert(insertRow);
    if (error) {
      result.errors.push(`Booking ${conf}: ${error.message}`);
    } else {
      result.bookingsCreated++;
      existingConf.add(conf);
    }
  }

  return result;
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Admin check
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const mode = body.mode === "commit" ? "commit" : "preview";
    const targetUserId: string = body.targetUserId || user.id;
    const tripsCsv: string | undefined = body.tripsCsv;
    const bookingsCsv: string | undefined = body.bookingsCsv;

    if (!tripsCsv && !bookingsCsv) {
      return new Response(JSON.stringify({ error: "Provide tripsCsv and/or bookingsCsv" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tripRowsRaw = tripsCsv ? parseCSV(tripsCsv) : [];
    const bookingRowsRaw = bookingsCsv ? parseCSV(bookingsCsv) : [];
    if (tripRowsRaw.length > MAX_ROWS || bookingRowsRaw.length > MAX_ROWS) {
      return new Response(JSON.stringify({ error: `Max ${MAX_ROWS} rows per file` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const trips = parseTripsCsv(tripRowsRaw);
    const bookings = parseBookingsCsv(bookingRowsRaw);

    if (mode === "preview") {
      const plan = await buildPlan(supabase, targetUserId, trips, bookings);
      return new Response(JSON.stringify({
        parsed: { trips: trips.length, bookings: bookings.length, tripRowsRaw: tripRowsRaw.length, bookingRowsRaw: bookingRowsRaw.length },
        plan,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const result = await commit(supabase, targetUserId, trips, bookings);
      return new Response(JSON.stringify({
        parsed: { trips: trips.length, bookings: bookings.length },
        result,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    console.error("tern-import error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});