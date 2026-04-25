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

    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("trip_id, client_id")
      .eq("user_id", user.id)
      .in("trip_id", tripIds);
    const existingKey = new Set(
      (existingInvoices || []).map((i) => `${i.trip_id}::${i.client_id}`)
    );

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

    // Create invoices
    const created: { id: string }[] = [];
    const errors: string[] = [];

    for (const grp of byTrip.values()) {
      if (existingKey.has(`${grp.trip_id}::${grp.client_id}`)) continue;
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
        errors.push(`Insert invoice for ${grp.trip_name}: ${insErr?.message || "unknown"}`);
        continue;
      }
      created.push({ id: inv.id });
    }

    // Push each new invoice to QBO
    let synced = 0;
    let syncFailed = 0;
    for (const inv of created) {
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
        if (resp.ok) synced++;
        else {
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
      `[generate-tern-invoices] user=${user.id} created=${created.length} synced=${synced} failed=${syncFailed} errors=${errors.length}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        candidateTrips: byTrip.size,
        invoicesCreated: created.length,
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