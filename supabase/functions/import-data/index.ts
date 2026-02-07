import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ClientRecord {
  // New CSV fields
  "First Name"?: string;
  "Preferred First Name"?: string;
  "Last Name"?: string;
  "Primary Email"?: string;
  "Primary Phone Number"?: string;
  "Birthday"?: string;
  "Address Line 1"?: string;
  "Address Line 2"?: string;
  "Address Country"?: string;
  "Address City"?: string;
  "Address State"?: string;
  "Address Zip Code"?: string;
  "Loyalty Programs"?: string;
  "Tags"?: string;
  // Legacy fields for backward compatibility
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  status?: string;
  notes?: string;
}

interface BookingRecord {
  // New trips CSV format
  "Trip Name"?: string;
  "Trip Page"?: string;
  "Status"?: string;
  "Start Date"?: string;
  "End Date"?: string;
  "Primary Contact"?: string;
  "Owner Agent"?: string;
  "Gross Sale Amount (Your Currency)"?: string;
  // Legacy fields for backward compatibility
  client_name?: string;
  client_id?: string;
  booking_reference?: string;
  destination?: string;
  depart_date?: string;
  return_date?: string;
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

        // Support both new CSV format and legacy format
        const firstName = record["First Name"]?.trim() || "";
        const lastName = record["Last Name"]?.trim() || "";
        const legacyName = record.name?.trim() || "";
        
        // Build name from first/last or use legacy name field
        const fullName = firstName || lastName 
          ? `${firstName} ${lastName}`.trim() 
          : legacyName;

        if (!fullName) {
          errors.push({ index: i, error: "Name is required (First Name + Last Name or name field)", record });
          recordsFailed++;
          continue;
        }

        // Build location from address fields or use legacy location
        const addressParts = [
          record["Address Line 1"],
          record["Address Line 2"],
          record["Address City"],
          record["Address State"],
          record["Address Zip Code"],
          record["Address Country"],
        ].filter(Boolean);
        const location = addressParts.length > 0 
          ? addressParts.join(", ") 
          : record.location?.trim() || null;

        const clientInsert = {
          user_id: targetUserId,
          name: fullName,
          first_name: firstName || null,
          preferred_first_name: record["Preferred First Name"]?.trim() || null,
          last_name: lastName || null,
          email: record["Primary Email"]?.trim() || record.email?.trim() || null,
          phone: record["Primary Phone Number"]?.trim() || record.phone?.trim() || null,
          birthday: record["Birthday"] || null,
          address_line_1: record["Address Line 1"]?.trim() || null,
          address_line_2: record["Address Line 2"]?.trim() || null,
          address_country: record["Address Country"]?.trim() || null,
          address_city: record["Address City"]?.trim() || null,
          address_state: record["Address State"]?.trim() || null,
          address_zip_code: record["Address Zip Code"]?.trim() || null,
          loyalty_programs: record["Loyalty Programs"]?.trim() || null,
          tags: record["Tags"]?.trim() || null,
          location: location,
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
        .select("id, name, first_name, last_name")
        .eq("user_id", targetUserId);

      // Create multiple lookup maps for flexible matching
      const clientMap = new Map<string, string>();
      const clientFirstLastMap = new Map<string, string>();
      
      for (const c of existingClients || []) {
        // Normalize name by removing extra spaces and lowercasing
        const normalizedName = c.name.toLowerCase().replace(/\s+/g, " ").trim();
        clientMap.set(normalizedName, c.id);
        
        // Also create lookup by first_name + last_name
        if (c.first_name && c.last_name) {
          const firstLast = `${c.first_name} ${c.last_name}`.toLowerCase().replace(/\s+/g, " ").trim();
          clientFirstLastMap.set(firstLast, c.id);
        }
      }

      for (let i = 0; i < bookingData.length; i++) {
        const record = bookingData[i];

        // Check if this is the new trips CSV format
        const isTripsFormat = record["Trip Name"] !== undefined;

        let tripName: string | null = null;
        let tripPageUrl: string | null = null;
        let departDate: string | null = null;
        let returnDate: string | null = null;
        let clientName: string | null = null;
        let ownerAgent: string | null = null;
        let totalAmount: number = 0;
        let status: string = "pending";
        let bookingReference: string | null = null;
        let destination: string | null = null;

        if (isTripsFormat) {
          tripName = record["Trip Name"]?.trim() || null;
          
          // Extract URL from Trip Page field (format: {caption}view{/caption}https://...)
          const tripPageRaw = record["Trip Page"] || "";
          const urlMatch = tripPageRaw.match(/https?:\/\/[^\s"]+/);
          tripPageUrl = urlMatch ? urlMatch[0] : null;
          
          // Extract trip ID from URL for booking reference
          const tripIdMatch = tripPageUrl?.match(/\/trips\/(\d+)/);
          bookingReference = tripIdMatch ? `TRIP-${tripIdMatch[1]}` : `TRIP-${Date.now()}-${i}`;
          
          // Use trip name as destination
          destination = tripName || "Unknown";
          
          departDate = record["Start Date"] || null;
          returnDate = record["End Date"] || null;
          
          // Parse primary contact - skip records with '--' as contact
          const primaryContact = record["Primary Contact"]?.trim() || "";
          if (primaryContact === "'--" || primaryContact === "--" || !primaryContact) {
            // Skip group/inbound trips without a specific client
            console.log(`Skipping trip "${tripName}" - no primary contact assigned`);
            continue;
          }
          clientName = primaryContact;
          
          ownerAgent = record["Owner Agent"]?.trim() || null;
          
          // Parse amount
          const amountStr = record["Gross Sale Amount (Your Currency)"] || "0";
          totalAmount = parseFloat(amountStr.replace(/[^0-9.-]/g, "")) || 0;
          
          // Map status: Booked -> confirmed, Planning -> pending, Inbound -> pending, Archived -> completed
          const tripStatus = record["Status"]?.trim().toLowerCase() || "";
          if (tripStatus === "booked") {
            status = "confirmed";
          } else if (tripStatus === "planning" || tripStatus === "inbound") {
            status = "pending";
          } else if (tripStatus === "archived") {
            status = "completed";
          } else {
            status = "pending";
          }
        } else {
          // Legacy format
          bookingReference = record.booking_reference?.trim() || null;
          destination = record.destination?.trim() || null;
          departDate = record.depart_date || null;
          returnDate = record.return_date || null;
          clientName = record.client_name || null;
          totalAmount = record.total_amount || 0;
          status = ["confirmed", "pending", "cancelled", "completed"].includes(record.status || "")
            ? record.status!
            : "pending";
        }

        // Validate required fields
        if (!departDate || !returnDate) {
          errors.push({
            index: i,
            error: "Start date and end date are required",
            record,
          });
          recordsFailed++;
          continue;
        }

        // Resolve client_id with fuzzy name matching
        let clientId = record.client_id;
        if (!clientId && clientName) {
          // Normalize the client name from CSV
          const normalizedClientName = clientName.toLowerCase().replace(/\s+/g, " ").trim();
          
          // Try exact match first
          clientId = clientMap.get(normalizedClientName);
          
          // Try first_name + last_name lookup
          if (!clientId) {
            clientId = clientFirstLastMap.get(normalizedClientName);
          }
          
          // Try partial matching (first name only or last name only)
          if (!clientId) {
            const nameParts = normalizedClientName.split(" ");
            for (const [key, id] of clientMap.entries()) {
              // Check if all parts of the search name are in the client name
              const allPartsMatch = nameParts.every(part => key.includes(part));
              if (allPartsMatch) {
                clientId = id;
                break;
              }
            }
          }
          
          if (!clientId) {
            errors.push({
              index: i,
              error: `Client "${clientName}" not found. Import clients first.`,
              record,
            });
            recordsFailed++;
            continue;
          }
        }

        if (!clientId) {
          errors.push({ index: i, error: "client_id or Primary Contact is required", record });
          recordsFailed++;
          continue;
        }

        const bookingInsert = {
          user_id: targetUserId,
          client_id: clientId,
          booking_reference: bookingReference || `BK-${Date.now()}-${i}`,
          destination: destination || "Unknown",
          depart_date: departDate,
          return_date: returnDate,
          travelers: record.travelers || 1,
          total_amount: totalAmount,
          status: status,
          notes: record.notes?.trim() || null,
          trip_name: tripName,
          trip_page_url: tripPageUrl,
          owner_agent: ownerAgent,
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
