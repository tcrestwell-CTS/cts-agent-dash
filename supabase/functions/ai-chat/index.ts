import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM_PROMPT = `You are Donna, Crestwell's in-app AI assistant for travel agents. You help with:

1. Creating group trips (parent trip + optional sub-trips for each cabin/room/family). Group trips use trip_type='group' and sub-trips link via parent_trip_id.
2. Managing workflow tasks (list, create, complete) tied to trips. Tasks have task_type (follow_up, payment_due, document_request, supplier_followup, internal_review) and status (pending, in_progress, completed).
3. Converting approved lead proposals into CRM clients. When the advisor approves a lead (a quote_requests row with proposal_status='approved' or status='approved') and asks you to add them as a client, call create_client_from_lead with the quote_request_id. It copies name, email, phone, location, and lead_source into public.clients and links the quote request via converted_trip_id if a trip is created later.

Always confirm important details (dates, destination, number of sub-trips, task due dates) before calling tools when ambiguous. Be concise. Introduce yourself as Donna on the first turn only. After calling tools, summarize what you did in one or two sentences.`;

type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: any; tool_call_id?: string; name?: string };

const tools = [
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "List the current user's workflow tasks. Optionally filter by status or trip_id.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "in_progress", "completed"] },
          trip_id: { type: "string", description: "Filter to one trip" },
          limit: { type: "number", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a workflow task on a trip the user owns.",
      parameters: {
        type: "object",
        properties: {
          trip_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          task_type: {
            type: "string",
            enum: ["follow_up", "payment_due", "document_request", "supplier_followup", "internal_review"],
          },
          due_at: { type: "string", description: "ISO timestamp" },
        },
        required: ["trip_id", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Mark a workflow task as completed.",
      parameters: {
        type: "object",
        properties: { task_id: { type: "string" } },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_trips",
      description: "Search the user's trips by name/destination. Returns id, trip_name, destination, status.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number", default: 10 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "research_client",
      description: "Fetch a comprehensive summary of a client: all trips, bookings, payments, and notes. Use when the user asks to 'research' or 'summarize' a client.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "UUID of the client to research" },
        },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_trip_details",
      description: "Get full details of a specific trip: bookings, payments, itinerary items, and tasks.",
      parameters: {
        type: "object",
        properties: {
          trip_id: { type: "string" },
        },
        required: ["trip_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_client_details",
      description: "Get basic details of a client by ID.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
        },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_client_from_lead",
      description:
        "Create a CRM client record from an approved lead (quote_requests row). Use when the advisor has approved a lead proposal and wants to add the lead as a client. Skips creation and returns the existing client if one already exists for this user with the same email.",
      parameters: {
        type: "object",
        properties: {
          quote_request_id: { type: "string", description: "UUID of the quote_requests row to convert." },
        },
        required: ["quote_request_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_group_trip",
      description:
        "Create a parent group trip and optional sub-trips. Each sub-trip is linked to the parent via parent_trip_id and inherits trip_type='group'.",
      parameters: {
        type: "object",
        properties: {
          trip_name: { type: "string" },
          destination: { type: "string" },
          depart_date: { type: "string", description: "YYYY-MM-DD" },
          return_date: { type: "string", description: "YYYY-MM-DD" },
          client_id: { type: "string", description: "Optional primary client UUID" },
          notes: { type: "string" },
          sub_trips: {
            type: "array",
            description: "Optional list of sub-trips (e.g. one per cabin/family).",
            items: {
              type: "object",
              properties: {
                trip_name: { type: "string" },
                client_id: { type: "string" },
                notes: { type: "string" },
              },
              required: ["trip_name"],
            },
          },
        },
        required: ["trip_name"],
      },
    },
  },
];

async function runTool(name: string, args: any, userId: string, supabase: any) {
  switch (name) {
    case "list_tasks": {
      let q = supabase
        .from("workflow_tasks")
        .select("id, trip_id, title, description, task_type, status, due_at, created_at")
        .eq("user_id", userId)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(args.limit ?? 20);
      if (args.status) q = q.eq("status", args.status);
      if (args.trip_id) q = q.eq("trip_id", args.trip_id);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { tasks: data };
    }
    case "create_task": {
      const { data, error } = await supabase
        .from("workflow_tasks")
        .insert({
          user_id: userId,
          trip_id: args.trip_id,
          title: args.title,
          description: args.description ?? null,
          task_type: args.task_type ?? "follow_up",
          due_at: args.due_at ?? null,
          status: "pending",
        })
        .select()
        .single();
      if (error) return { error: error.message };
      return { task: data };
    }
    case "complete_task": {
      const { data, error } = await supabase
        .from("workflow_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", args.task_id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) return { error: error.message };
      return { task: data };
    }
    case "search_trips": {
      const q = (args.query ?? "").trim();
      let query = supabase
        .from("trips")
        .select("id, trip_name, destination, status, depart_date, return_date, trip_type, parent_trip_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(args.limit ?? 10);
      if (q) query = query.or(`trip_name.ilike.%${q}%,destination.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { trips: data };
    }
    case "create_group_trip": {
      const parentPayload: any = {
        user_id: userId,
        trip_name: args.trip_name,
        destination: args.destination ?? null,
        depart_date: args.depart_date ?? null,
        return_date: args.return_date ?? null,
        client_id: args.client_id ?? null,
        notes: args.notes ?? null,
        trip_type: "group",
        status: "lead",
      };
      const { data: parent, error: pErr } = await supabase
        .from("trips")
        .insert(parentPayload)
        .select()
        .single();
      if (pErr) return { error: pErr.message };

      let subResults: any[] = [];
      if (Array.isArray(args.sub_trips) && args.sub_trips.length > 0) {
        const subRows = args.sub_trips.map((s: any) => ({
          user_id: userId,
          trip_name: s.trip_name,
          destination: args.destination ?? null,
          depart_date: args.depart_date ?? null,
          return_date: args.return_date ?? null,
          client_id: s.client_id ?? null,
          notes: s.notes ?? null,
          parent_trip_id: parent.id,
          trip_type: "regular",
          status: "lead",
        }));
        const { data: subs, error: sErr } = await supabase
          .from("trips")
          .insert(subRows)
          .select("id, trip_name, parent_trip_id");
        if (sErr) return { parent_trip: parent, sub_trip_error: sErr.message };
        subResults = subs ?? [];
      }
      return { parent_trip: parent, sub_trips: subResults };
    }
    case "research_client": {
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .select("id, name, email, phone, created_at")
        .eq("id", args.client_id)
        .single();
      if (cErr) return { error: cErr.message };

      const [tripsRes, notesRes] = await Promise.all([
        supabase.from("trips")
          .select("id, trip_name, destination, status, depart_date, return_date, total_gross_sales, created_at")
          .eq("client_id", args.client_id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("client_notes")
          .select("id, note, created_at")
          .eq("client_id", args.client_id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const trips = tripsRes.data || [];
      const totalRevenue = trips.reduce((sum: number, t: any) => sum + (t.total_gross_sales || 0), 0);
      const upcomingTrips = trips.filter((t: any) => t.status !== "completed" && t.status !== "cancelled");

      return {
        client,
        summary: {
          total_trips: trips.length,
          total_revenue: totalRevenue,
          upcoming_trips: upcomingTrips.length,
          last_trip: trips[0] ?? null,
        },
        trips: trips.slice(0, 10),
        notes: notesRes.data || [],
      };
    }
    case "get_trip_details": {
      const [tripRes, bookingsRes, paymentsRes, tasksRes] = await Promise.all([
        supabase.from("trips")
          .select("id, trip_name, destination, status, depart_date, return_date, total_gross_sales, notes")
          .eq("id", args.trip_id).single(),
        supabase.from("bookings")
          .select("id, confirmation_number, status, gross_sales, suppliers(name, supplier_type)")
          .eq("trip_id", args.trip_id),
        supabase.from("trip_payments")
          .select("id, amount, status, payment_type, due_date")
          .eq("trip_id", args.trip_id),
        supabase.from("workflow_tasks")
          .select("id, title, status, task_type, due_at")
          .eq("trip_id", args.trip_id)
          .eq("user_id", userId),
      ]);
      return {
        trip: tripRes.data,
        bookings: bookingsRes.data || [],
        payments: paymentsRes.data || [],
        tasks: tasksRes.data || [],
      };
    }
    case "get_client_details": {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, email, phone, created_at")
        .eq("id", args.client_id)
        .single();
      if (error) return { error: error.message };
      return { client: data };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Use service role for tool execution but always scope queries by userId.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json() as {
      messages: ChatMessage[];
      context?: { tripId?: string | null; clientId?: string | null };
      attachment?: { name: string; type: string; base64: string; mimeType: string };
      researchClient?: boolean;
    };

    const { messages, context, attachment, researchClient } = body;
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context-aware system prompt
    let contextBlock = "";
    if (context?.tripId) {
      contextBlock += `\n\nCURRENT PAGE: The advisor is currently viewing trip ID: ${context.tripId}. When they refer to "this trip" or "the current trip", use this ID automatically.`;
    }
    if (context?.clientId) {
      contextBlock += `\n\nCURRENT PAGE: The advisor is currently viewing client ID: ${context.clientId}. When they ask to "research this client" or refer to "this client", use this ID automatically.`;
    }
    if (researchClient && (context?.clientId || context?.tripId)) {
      const targetId = context?.clientId;
      if (targetId) {
        contextBlock += `\n\nIMPORTANT: The advisor wants a full research summary of client ${targetId}. Call research_client immediately with this client_id.`;
      }
    }

    // Build attachment content if file was attached
    let attachmentMessage: ChatMessage | null = null;
    if (attachment) {
      if (attachment.type === "pdf" || attachment.type === "text" || attachment.type === "csv") {
        // For text-based files, include base64 content as a user message context
        attachmentMessage = {
          role: "user",
          content: `[File attached: ${attachment.name} (${attachment.type.toUpperCase()})]\nThe file content (base64-encoded) is provided below for your analysis:\n${attachment.base64.substring(0, 8000)}${attachment.base64.length > 8000 ? "\n...[truncated]" : ""}`,
        };
      } else if (attachment.type === "image") {
        // Images are passed as vision content
        attachmentMessage = {
          role: "user",
          content: JSON.stringify([
            { type: "text", text: `[Image attached: ${attachment.name}]` },
            { type: "image_url", image_url: { url: `data:${attachment.mimeType};base64,${attachment.base64}` } },
          ]),
        };
      }
    }

    const convo: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT + contextBlock },
      ...(attachmentMessage ? [attachmentMessage] : []),
      ...messages,
    ];

    // Tool loop, max 5 turns to avoid runaway.
    for (let turn = 0; turn < 5; turn++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools,
          tool_choice: "auto",
        }),
      });

      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI gateway error", resp.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls } as any);
        for (const tc of toolCalls) {
          let parsed: any = {};
          try { parsed = JSON.parse(tc.function.arguments || "{}"); } catch (_) { parsed = {}; }
          const result = await runTool(tc.function.name, parsed, userId, adminClient);
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      return new Response(
        JSON.stringify({ reply: msg.content ?? "", tool_trace: convo.slice(messages.length + 1) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ reply: "I wasn't able to finish that request — try rephrasing or breaking it up." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});