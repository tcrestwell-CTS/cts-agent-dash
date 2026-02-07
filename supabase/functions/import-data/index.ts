import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ClientRecord {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  status?: string;
  notes?: string;
}

interface BookingRecord {
  client_name?: string;
  client_id?: string;
  booking_reference: string;
  destination: string;
  depart_date: string;
  return_date: string;
  travelers?: number;
  total_amount?: number;
  status?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create user client to verify auth
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", user.id);

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleData) {
      console.error("User is not admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin verified");

    // Parse request body
    const body = await req.json();
    const { type, data, targetUserId, fileName } = body as {
      type: "clients" | "bookings";
      data: ClientRecord[] | BookingRecord[];
      targetUserId: string;
      fileName?: string;
    };

    if (!type || !data || !Array.isArray(data) || !targetUserId) {
      return new Response(
        JSON.stringify({ error: "Invalid request: type, data array, and targetUserId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Importing ${data.length} ${type} records for user ${targetUserId}`);

    // Create import log
    const { data: logData, error: logError } = await supabase
      .from("import_logs")
      .insert({
        user_id: user.id,
        import_type: type,
        file_name: fileName,
        status: "processing",
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create import log:", logError);
    }

    const logId = logData?.id;
    let recordsImported = 0;
    let recordsFailed = 0;
    const errors: { index: number; error: string; record: unknown }[] = [];

    if (type === "clients") {
      const clientData = data as ClientRecord[];

      for (let i = 0; i < clientData.length; i++) {
        const record = clientData[i];

        if (!record.name || typeof record.name !== "string" || record.name.trim() === "") {
          errors.push({ index: i, error: "Name is required", record });
          recordsFailed++;
          continue;
        }

        const clientInsert = {
          user_id: targetUserId,
          name: record.name.trim(),
          email: record.email?.trim() || null,
          phone: record.phone?.trim() || null,
          location: record.location?.trim() || null,
          status: ["active", "lead", "inactive"].includes(record.status || "")
            ? record.status
            : "lead",
          notes: record.notes?.trim() || null,
        };

        const { error: insertError } = await supabase.from("clients").insert(clientInsert);

        if (insertError) {
          console.error(`Failed to insert client at index ${i}:`, insertError);
          errors.push({ index: i, error: insertError.message, record });
          recordsFailed++;
        } else {
          recordsImported++;
        }
      }
    } else if (type === "bookings") {
      const bookingData = data as BookingRecord[];

      // First, get all clients for the target user to match by name
      const { data: existingClients } = await supabase
        .from("clients")
        .select("id, name")
        .eq("user_id", targetUserId);

      const clientMap = new Map(
        (existingClients || []).map((c) => [c.name.toLowerCase(), c.id])
      );

      for (let i = 0; i < bookingData.length; i++) {
        const record = bookingData[i];

        // Validate required fields
        if (!record.booking_reference || !record.destination || !record.depart_date || !record.return_date) {
          errors.push({
            index: i,
            error: "booking_reference, destination, depart_date, and return_date are required",
            record,
          });
          recordsFailed++;
          continue;
        }

        // Resolve client_id
        let clientId = record.client_id;
        if (!clientId && record.client_name) {
          clientId = clientMap.get(record.client_name.toLowerCase());
          if (!clientId) {
            errors.push({
              index: i,
              error: `Client "${record.client_name}" not found. Import clients first.`,
              record,
            });
            recordsFailed++;
            continue;
          }
        }

        if (!clientId) {
          errors.push({ index: i, error: "client_id or client_name is required", record });
          recordsFailed++;
          continue;
        }

        const bookingInsert = {
          user_id: targetUserId,
          client_id: clientId,
          booking_reference: record.booking_reference.trim(),
          destination: record.destination.trim(),
          depart_date: record.depart_date,
          return_date: record.return_date,
          travelers: record.travelers || 1,
          total_amount: record.total_amount || 0,
          status: ["confirmed", "pending", "cancelled", "completed"].includes(record.status || "")
            ? record.status
            : "pending",
          notes: record.notes?.trim() || null,
        };

        const { error: insertError } = await supabase.from("bookings").insert(bookingInsert);

        if (insertError) {
          console.error(`Failed to insert booking at index ${i}:`, insertError);
          errors.push({ index: i, error: insertError.message, record });
          recordsFailed++;
        } else {
          recordsImported++;
        }
      }
    }

    // Update import log
    if (logId) {
      await supabase
        .from("import_logs")
        .update({
          records_imported: recordsImported,
          records_failed: recordsFailed,
          status: recordsFailed === 0 ? "completed" : "completed_with_errors",
          error_details: errors.length > 0 ? errors : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    console.log(`Import complete: ${recordsImported} imported, ${recordsFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        recordsImported,
        recordsFailed,
        errors: errors.slice(0, 10), // Return first 10 errors
        totalErrors: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
