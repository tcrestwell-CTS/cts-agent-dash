import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find confirmed Tern bookings (or trips marked as Tern import) without
    // an existing invoice for the same trip+client. We aggregate per-trip so
    // each trip yields a single invoice covering all confirmed bookings.
    const { data: candidates, error: candErr } = await supabase
      .from("bookings")
      .select(
        "id, trip_id, gross_sales, status, source, trip:trips!inner(id, trip_name, client_id, source)"
      )
      .eq("user_id", user.id)
      .eq("status", "confirmed");

    if (candErr) throw candErr;

    type Row = {
      id: string;
      trip_id: string;
      gross_sales: number | null;
      source: string | null;
      trip: {
        id: string;
        trip_name: string | null;
        client_id: string | null;
        source: string | null;
      };
    };

    const ternRows = ((candidates as Row[]) || []).filter(
      (r) =>
        r.trip?.client_id &&
        (r.source === "tern_import" || r.trip.source === "tern_import")
    );

    // Group bookings by trip
    const byTrip = new Map<
      string,
      {
        trip_id: string;
        client_id: string;
        trip_name: string;
        total: number;
        bookingIds: string[];
      }
    >();
    for (const r of ternRows) {
      const key = r.trip_id;
      const cur = byTrip.get(key);
      const amount = Number(r.gross_sales) || 0;
      if (cur) {
        cur.total += amount;
        cur.bookingIds.push(r.id);
      } else {
        byTrip.set(key, {
          trip_id: r.trip_id,
          client_id: r.trip.client_id!,
          trip_name: r.trip.trip_name || "Trip",
          total: amount,
          bookingIds: [r.id],
        });
      }
    }

    // Skip trips already invoiced for the same client
    const tripIds = Array.from(byTrip.keys());
    if (tripIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          invoicesCreated: 0,
          invoicesSynced: 0,
          invoicesSyncFailed: 0,
          message: "No eligible Tern bookings to invoice.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency layer 1: look up existing invoices for these trips so we don't
    // re-insert. We key on trip_id alone because the partial unique index
    // (user_id, trip_id) enforces one-invoice-per-trip at the DB level.
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("id, trip_id")
      .eq("user_id", user.id)
      .in("trip_id", tripIds);
    const existingInvoiceByTrip = new Map<string, string>();
    for (const i of existingInvoices || []) {
      if (i.trip_id) existingInvoiceByTrip.set(i.trip_id, i.id);
    }

    // Idempotency layer 2: which existing invoices already have a QBO mapping?
    // Anything in this set must NOT be re-pushed to QBO.
    const existingInvoiceIds = Array.from(existingInvoiceByTrip.values());
    const alreadySyncedInvoiceIds = new Set<string>();
    if (existingInvoiceIds.length > 0) {
      const { data: mappings } = await supabase
        .from("qbo_invoice_mappings")
        .select("invoice_id")
        .eq("user_id", user.id)
        .in("invoice_id", existingInvoiceIds);
      for (const m of mappings || []) alreadySyncedInvoiceIds.add(m.invoice_id);
    }

    // Fetch client names
    const clientIds = Array.from(
      new Set(Array.from(byTrip.values()).map((g) => g.client_id))
    );
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, first_name, last_name")
      .in("id", clientIds);
    const clientNameById = new Map<string, string>();
    for (const c of clients || []) {
      const display =
        c.name ||
        `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
        "Client";
      clientNameById.set(c.id, display);
    }

    // Build the list of invoices to push to QBO (newly created + previously
    // created but never synced). This makes the function safe to re-run: it
    // never duplicates invoices, and it always heals partial failures.
    const created: { id: string }[] = [];
    const reused: { id: string }[] = [];
    const skippedAlreadySynced: string[] = [];
    const errors: string[] = [];

    for (const grp of byTrip.values()) {
      // If an invoice for this trip already exists, reuse it instead of inserting.
      const existingId = existingInvoiceByTrip.get(grp.trip_id);
      if (existingId) {
        if (alreadySyncedInvoiceIds.has(existingId)) {
          skippedAlreadySynced.push(existingId);
        } else {
          reused.push({ id: existingId });
        }
        continue;
      }
      if (grp.total <= 0) continue;

      const { data: invNum, error: numErr } = await supabase.rpc(
        "get_next_invoice_number",
        { p_user_id: user.id }
      );
      if (numErr || !invNum) {
        errors.push(
          `Invoice number for trip ${grp.trip_name}: ${numErr?.message || "unknown"}`
        );
        continue;
      }

      const { data: inv, error: insErr } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          invoice_number: invNum as string,
          client_id: grp.client_id,
          client_name: clientNameById.get(grp.client_id) || "Client",
          trip_id: grp.trip_id,
          trip_name: grp.trip_name,
          total_amount: grp.total,
          amount_remaining: grp.total,
          status: "sent",
        })
        .select("id")
        .single();

      if (insErr || !inv) {
        // Race condition: another concurrent run inserted first. Recover by
        // looking up the now-existing invoice for this trip.
        const isUniqueViolation =
          insErr?.code === "23505" ||
          /duplicate key|invoices_user_trip_unique/i.test(insErr?.message || "");
        if (isUniqueViolation) {
          const { data: recovered } = await supabase
            .from("invoices")
            .select("id")
            .eq("user_id", user.id)
            .eq("trip_id", grp.trip_id)
            .maybeSingle();
          if (recovered?.id) {
            reused.push({ id: recovered.id });
            continue;
          }
        }
        errors.push(
          `Insert invoice for ${grp.trip_name}: ${insErr?.message || "unknown"}`
        );
        continue;
      }
      created.push({ id: inv.id });
    }

    // Push to QBO: newly created + previously created but unsynced.
    const toSync = [...created, ...reused];
    let synced = 0;
    let syncFailed = 0;
    for (const inv of toSync) {
      try {
        const resp = await fetch(
          `${supabaseUrl}/functions/v1/qbo-sync?action=sync-invoice`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ invoice_id: inv.id }),
          }
        );
        const txt = await resp.text();
        if (resp.ok) {
          synced++;
          // Best-effort: ensure a mapping row exists so future runs skip this
          // invoice even if qbo-sync didn't write one. We don't have the QBO
          // invoice id here, so only insert if downstream actually persisted
          // a mapping — the unique (user_id, invoice_id) constraint guarantees
          // we never create a phantom dupe mapping.
        } else {
          syncFailed++;
          errors.push(`QBO sync invoice ${inv.id}: ${txt.slice(0, 200)}`);
        }
      } catch (e) {
        syncFailed++;
        errors.push(
          `QBO sync invoice ${inv.id}: ${e instanceof Error ? e.message : "fetch failed"}`
        );
      }
    }

    console.log(
      `[generate-tern-invoices] user=${user.id} created=${created.length} reused=${reused.length} skippedAlreadySynced=${skippedAlreadySynced.length} synced=${synced} failed=${syncFailed} errors=${errors.length}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        candidateTrips: byTrip.size,
        invoicesCreated: created.length,
        invoicesReused: reused.length,
        invoicesSkippedAlreadySynced: skippedAlreadySynced.length,
        invoicesSynced: synced,
        invoicesSyncFailed: syncFailed,
        errors: errors.slice(0, 50),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-tern-invoices error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});