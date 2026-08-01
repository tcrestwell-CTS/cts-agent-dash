import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT =
  `You are Notes Chat, the research assistant for Crestwell Travel Services agents.
You answer questions about client history using ONLY the CRM records supplied in the CONTEXT block.

Rules:
- Never invent clients, dates, amounts, suppliers or preferences. If the context does not contain the answer, say so plainly and suggest a better search term.
- Be concise. Lead with the direct answer, then supporting detail.
- Cite the record you used inline like [Call note - Jane Doe, 2026-03-04] or [Trip - Alaska Cruise].
- When several clients match, list them briefly and ask which one they mean.
- Use markdown (short paragraphs, bullet lists). Never output raw JSON.
- Money and dates must be copied exactly as they appear in the context.`;

const STOPWORDS = new Set(
  ("the a an and or of for to in on with what which who when where why how is are was were did do does " +
    "any all my our their his her about tell me show find search anything something client clients trip trips " +
    "note notes said say told last this that there here have has had been being").split(" "),
);

function keywords(text: string): string[] {
  const words = (text.toLowerCase().match(/[a-z0-9'@.-]{3,}/g) ?? [])
    .map((w) => w.replace(/^[.'-]+|[.'-]+$/g, ""))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 6);
}

function orFilter(cols: string[], terms: string[]): string {
  return cols.flatMap((c) => terms.map((t) => `${c}.ilike.%${t}%`)).join(",");
}

function trim(v: unknown, max = 900): string {
  const s = typeof v === "string" ? v : Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "AI is not configured" }, 500);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabaseUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const history = rawMessages
      .filter((m: { role?: string; content?: string }) =>
        (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim()
      )
      .slice(-12)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (!lastUser) return json({ error: "Ask a question to get started." }, 400);
    const scopeClientId: string | null = typeof body?.client_id === "string" ? body.client_id : null;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: { role: string }) =>
      r.role === "admin" || r.role === "office_admin"
    );

    const terms = keywords(lastUser.content);
    const scope = <T>(q: T): T => (isAdmin ? q : (q as any).eq("user_id", user.id));

    // --- Clients ---
    let clientQ: any = supabaseAdmin
      .from("clients")
      .select("id, name, email, phone, status, membership_tier, location, notes, tags, food_drink_allergies, activities_interests, loyalty_programs, user_id")
      .order("updated_at", { ascending: false })
      .limit(12);
    clientQ = scope(clientQ);
    if (scopeClientId) clientQ = clientQ.eq("id", scopeClientId);
    else if (terms.length) clientQ = clientQ.or(orFilter(["name", "email", "notes", "location"], terms));
    const { data: clients } = await clientQ;

    const clientIds = (clients ?? []).map((c: { id: string }) => c.id);
    const relevantClientIds = scopeClientId ? [scopeClientId] : clientIds;

    // --- Call notes ---
    let notesQ: any = supabaseAdmin
      .from("client_call_notes")
      .select("id, client_id, call_date, call_type, title, summary, key_points, action_items, sentiment, follow_up_date")
      .order("call_date", { ascending: false })
      .limit(25);
    notesQ = scope(notesQ);
    if (scopeClientId) notesQ = notesQ.eq("client_id", scopeClientId);
    else if (terms.length) {
      notesQ = relevantClientIds.length
        ? notesQ.or(
          `${orFilter(["title", "summary", "transcript"], terms)},client_id.in.(${relevantClientIds.join(",")})`,
        )
        : notesQ.or(orFilter(["title", "summary", "transcript"], terms));
    }
    const { data: notes } = await notesQ;

    // --- Trips ---
    let tripQ: any = supabaseAdmin
      .from("trips")
      .select("id, client_id, trip_name, destination, trip_type, status, departure_date, return_date, ship_name, notes, total_gross_sales, total_commission_revenue")
      .order("updated_at", { ascending: false })
      .limit(20);
    tripQ = scope(tripQ);
    if (scopeClientId) tripQ = tripQ.eq("client_id", scopeClientId);
    else if (terms.length) {
      tripQ = relevantClientIds.length
        ? tripQ.or(
          `${orFilter(["trip_name", "destination", "notes", "ship_name"], terms)},client_id.in.(${relevantClientIds.join(",")})`,
        )
        : tripQ.or(orFilter(["trip_name", "destination", "notes", "ship_name"], terms));
    }
    const { data: trips } = await tripQ;

    // --- Portal messages ---
    let msgQ: any = supabaseAdmin
      .from("portal_messages")
      .select("id, client_id, sender_type, message, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!isAdmin) msgQ = msgQ.eq("agent_user_id", user.id);
    if (relevantClientIds.length) msgQ = msgQ.in("client_id", relevantClientIds);
    else if (terms.length) msgQ = msgQ.or(orFilter(["message"], terms));
    const { data: messages } = await msgQ;

    // --- Leads / quote requests ---
    let leadQ: any = supabaseAdmin
      .from("quote_requests")
      .select("id, first_name, last_name, email, destination, trip_type, departure_date, budget, status, ai_summary, message, created_at")
      .order("created_at", { ascending: false })
      .limit(12);
    if (!isAdmin) leadQ = leadQ.eq("assigned_agent_id", user.id);
    if (terms.length) {
      leadQ = leadQ.or(orFilter(["first_name", "last_name", "email", "destination", "ai_summary", "message"], terms));
    }
    const { data: leads } = await leadQ;

    const nameFor = (id: string | null) =>
      (clients ?? []).find((c: { id: string }) => c.id === id)?.name ?? "Unknown client";

    const sections: string[] = [];
    if (clients?.length) {
      sections.push(
        "CLIENTS\n" + clients.map((c: any) =>
          `- [Client - ${c.name}] email=${c.email ?? "n/a"} phone=${c.phone ?? "n/a"} status=${c.status ?? "n/a"} tier=${c.membership_tier ?? "n/a"} location=${c.location ?? "n/a"}` +
          `\n  allergies: ${trim(c.food_drink_allergies, 200)}\n  interests: ${trim(c.activities_interests, 200)}\n  loyalty: ${trim(c.loyalty_programs, 200)}\n  notes: ${trim(c.notes)}`
        ).join("\n"),
      );
    }
    if (notes?.length) {
      sections.push(
        "CALL NOTES\n" + notes.map((n: any) =>
          `- [Call note - ${nameFor(n.client_id)}, ${n.call_date}] ${n.title ?? ""} (${n.call_type ?? "call"}, sentiment=${n.sentiment ?? "n/a"}, follow-up=${n.follow_up_date ?? "none"})` +
          `\n  summary: ${trim(n.summary)}\n  key points: ${trim(n.key_points, 500)}\n  action items: ${trim(n.action_items, 500)}`
        ).join("\n"),
      );
    }
    if (trips?.length) {
      sections.push(
        "TRIPS\n" + trips.map((t: any) =>
          `- [Trip - ${t.trip_name ?? t.destination ?? "Untitled"}] client=${nameFor(t.client_id)} destination=${t.destination ?? "n/a"} type=${t.trip_type ?? "n/a"} status=${t.status ?? "n/a"} depart=${t.departure_date ?? "n/a"} return=${t.return_date ?? "n/a"} ship=${t.ship_name ?? "n/a"} gross=${t.total_gross_sales ?? 0} commission=${t.total_commission_revenue ?? 0}` +
          `\n  notes: ${trim(t.notes)}`
        ).join("\n"),
      );
    }
    if (messages?.length) {
      sections.push(
        "PORTAL MESSAGES\n" + messages.map((m: any) =>
          `- [Message - ${nameFor(m.client_id)}, ${String(m.created_at).slice(0, 10)}, from ${m.sender_type}] ${trim(m.message, 500)}`
        ).join("\n"),
      );
    }
    if (leads?.length) {
      sections.push(
        "LEADS\n" + leads.map((l: any) =>
          `- [Lead - ${[l.first_name, l.last_name].filter(Boolean).join(" ") || l.email}, ${String(l.created_at).slice(0, 10)}] destination=${l.destination ?? "n/a"} type=${l.trip_type ?? "n/a"} depart=${l.departure_date ?? "n/a"} budget=${l.budget ?? "n/a"} status=${l.status ?? "n/a"}` +
          `\n  summary: ${trim(l.ai_summary, 400)}\n  message: ${trim(l.message, 400)}`
        ).join("\n"),
      );
    }

    const context = sections.length
      ? sections.join("\n\n")
      : "No matching CRM records were found for this question.";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content:
              `Today is ${new Date().toISOString().slice(0, 10)}. Search terms used: ${terms.join(", ") || "(none)"}.\n\nCONTEXT\n${context.slice(0, 60000)}`,
          },
          ...history,
        ],
      }),
    });

    if (aiRes.status === 429) return json({ error: "AI is busy right now. Please try again in a moment." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits are exhausted. Please top up to keep using Notes Chat." }, 402);
    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("notes-chat AI error:", aiRes.status, text.slice(0, 400));
      return json({ error: "Notes Chat could not answer that. Please try again." }, 502);
    }

    const aiJson = await aiRes.json();
    const answer: string = aiJson?.choices?.[0]?.message?.content ?? "";
    if (!answer.trim()) return json({ error: "Notes Chat returned an empty answer. Please try again." }, 502);

    return json({
      answer,
      terms,
      sources: {
        clients: clients?.length ?? 0,
        call_notes: notes?.length ?? 0,
        trips: trips?.length ?? 0,
        messages: messages?.length ?? 0,
        leads: leads?.length ?? 0,
      },
    });
  } catch (err) {
    console.error("notes-chat error:", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
