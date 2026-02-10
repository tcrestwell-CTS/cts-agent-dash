import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-portal-token",
};

async function validatePortalToken(supabase: any, token: string) {
  const { data: session } = await supabase
    .from("client_portal_sessions")
    .select("client_id, email, expires_at, verified_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .not("verified_at", "is", null)
    .maybeSingle();

  return session;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const portalToken = req.headers.get("x-portal-token");
    if (!portalToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await validatePortalToken(supabase, portalToken);
    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = session.client_id;
    const url = new URL(req.url);
    const resource = url.searchParams.get("resource");

    if (resource === "dashboard") {
      // Get client info + trips + recent payments
      const [clientRes, tripsRes, paymentsRes, messagesRes] = await Promise.all([
        supabase.from("clients").select("id, name, first_name, last_name, email").eq("id", clientId).single(),
        supabase.from("trips").select("id, trip_name, destination, depart_date, return_date, status, total_gross_sales").eq("client_id", clientId).neq("status", "archived").order("depart_date", { ascending: false }),
        supabase.from("trip_payments").select("id, amount, payment_date, status, payment_type, trip_id, due_date").eq("status", "pending").order("due_date", { ascending: true }).limit(5),
        supabase.from("portal_messages").select("id, message, sender_type, created_at, read_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
      ]);

      // Filter payments to only those for this client's trips
      const tripIds = (tripsRes.data || []).map((t: any) => t.id);
      const clientPayments = (paymentsRes.data || []).filter((p: any) => tripIds.includes(p.trip_id));

      return new Response(JSON.stringify({
        client: clientRes.data,
        trips: tripsRes.data || [],
        upcoming_payments: clientPayments,
        recent_messages: messagesRes.data || [],
        unread_messages: (messagesRes.data || []).filter((m: any) => m.sender_type === "agent" && !m.read_at).length,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "trips") {
      const { data: trips } = await supabase
        .from("trips")
        .select("id, trip_name, destination, depart_date, return_date, status, total_gross_sales, notes, trip_type")
        .eq("client_id", clientId)
        .neq("status", "archived")
        .order("depart_date", { ascending: false });

      return new Response(JSON.stringify({ trips: trips || [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "trip-detail") {
      const tripId = url.searchParams.get("tripId");
      if (!tripId) {
        return new Response(JSON.stringify({ error: "tripId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [tripRes, bookingsRes, paymentsRes] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).eq("client_id", clientId).single(),
        supabase.from("bookings").select("id, booking_reference, destination, depart_date, return_date, status, total_amount, travelers, trip_name, supplier_id").eq("trip_id", tripId).eq("client_id", clientId),
        supabase.from("trip_payments").select("id, amount, payment_date, due_date, status, payment_type, details, notes").eq("trip_id", tripId),
      ]);

      if (!tripRes.data) {
        return new Response(JSON.stringify({ error: "Trip not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        trip: tripRes.data,
        bookings: bookingsRes.data || [],
        payments: paymentsRes.data || [],
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "invoices") {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total_amount, amount_paid, amount_remaining, status, trip_name")
        .eq("client_id", clientId)
        .order("invoice_date", { ascending: false });

      return new Response(JSON.stringify({ invoices: invoices || [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (resource === "messages") {
      if (req.method === "POST") {
        const { message } = await req.json();
        if (!message?.trim()) {
          return new Response(JSON.stringify({ error: "Message required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get client's agent
        const { data: client } = await supabase
          .from("clients")
          .select("user_id")
          .eq("id", clientId)
          .single();

        if (!client) {
          return new Response(JSON.stringify({ error: "Client not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: newMsg, error } = await supabase
          .from("portal_messages")
          .insert({
            client_id: clientId,
            agent_user_id: client.user_id,
            sender_type: "client",
            message: message.trim(),
          })
          .select()
          .single();

        if (error) {
          console.error("Message insert error:", error);
          throw error;
        }

        return new Response(JSON.stringify({ message: newMsg }), {
          status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // GET messages
      const { data: messages } = await supabase
        .from("portal_messages")
        .select("id, message, sender_type, created_at, read_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      // Mark agent messages as read
      await supabase
        .from("portal_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .eq("sender_type", "agent")
        .is("read_at", null);

      return new Response(JSON.stringify({ messages: messages || [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Invalid resource" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Portal data error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
