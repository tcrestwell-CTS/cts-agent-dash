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

const SYSTEM_PROMPT = `You are Nadia, the call notetaker for Crestwell Travel Services.
You turn a raw travel-agent call transcript or rough notes into clean, structured CRM notes.

Rules:
- Only use information present in the transcript. Never invent names, dates, prices, suppliers or preferences.
- If something is unknown, leave the field empty rather than guessing.
- Write in plain professional English, third person, from the agency's point of view.
- action_items are concrete next steps for the travel agent (verbs first).
- sentiment must be exactly one of: positive, neutral, concerned, negative.
- follow_up_date must be YYYY-MM-DD and only set when the transcript implies a specific follow-up timing (you may compute it from the call date). Otherwise leave it null.

Return ONLY valid JSON with this shape:
{"title": string, "summary": string, "key_points": string[], "action_items": string[], "sentiment": string, "follow_up_date": string | null}`;

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
    const transcript: string = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    const clientId: string | undefined = body?.client_id;
    const callDate: string = body?.call_date || new Date().toISOString().slice(0, 10);
    const callType: string = body?.call_type || "phone";
    const tripId: string | null = body?.trip_id || null;

    if (!clientId) return json({ error: "client_id is required" }, 400);
    if (transcript.length < 40) {
      return json({ error: "Paste a longer transcript or set of notes to summarize." }, 400);
    }
    if (transcript.length > 60000) {
      return json({ error: "That transcript is too long. Please split it into shorter calls." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ownership check: the caller must own the client, or be an admin/office admin.
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, name, user_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return json({ error: "Client not found" }, 404);

    let allowed = client.user_id === user.id;
    if (!allowed) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      allowed = (roles ?? []).some((r: { role: string }) =>
        r.role === "admin" || r.role === "office_admin"
      );
    }
    if (!allowed) return json({ error: "You do not have access to this client" }, 403);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `Client: ${client.name}\nCall date: ${callDate}\nCall type: ${callType}\n\nTranscript / notes:\n${transcript}`,
          },
        ],
      }),
    });

    if (aiRes.status === 429) {
      return json({ error: "AI is busy right now. Please try again in a moment." }, 429);
    }
    if (aiRes.status === 402) {
      return json({ error: "AI credits are exhausted. Please top up to keep using Nadia." }, 402);
    }
    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("nadia-notes AI error:", aiRes.status, text.slice(0, 400));
      return json({ error: "Nadia could not summarize that call. Please try again." }, 502);
    }

    const aiJson = await aiRes.json();
    const raw: string = aiJson?.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown>;
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      parsed = JSON.parse(start >= 0 ? raw.slice(start, end + 1) : raw);
    } catch {
      console.error("nadia-notes parse failure:", raw.slice(0, 300));
      return json({ error: "Nadia returned an unreadable summary. Please try again." }, 502);
    }

    const asStrings = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map(String) : [];
    const sentimentRaw = String(parsed.sentiment ?? "").toLowerCase();
    const sentiment = ["positive", "neutral", "concerned", "negative"].includes(sentimentRaw)
      ? sentimentRaw
      : null;
    const followUp = typeof parsed.follow_up_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(parsed.follow_up_date)
      ? parsed.follow_up_date
      : null;

    const { data: note, error: insertError } = await supabaseAdmin
      .from("client_call_notes")
      .insert({
        client_id: clientId,
        trip_id: tripId,
        user_id: user.id,
        call_date: callDate,
        call_type: callType,
        title: (typeof parsed.title === "string" && parsed.title.trim()) || "Client call",
        summary: typeof parsed.summary === "string" ? parsed.summary : null,
        key_points: asStrings(parsed.key_points),
        action_items: asStrings(parsed.action_items),
        sentiment,
        follow_up_date: followUp,
        transcript,
      })
      .select()
      .single();

    if (insertError) {
      console.error("nadia-notes insert error:", insertError.message);
      return json({ error: "Could not save the call note" }, 500);
    }

    // Activity log entry so the call shows in the agent's activity feed.
    await supabaseAdmin.from("activities").insert({
      user_id: user.id,
      activity_type: "call_note",
      entity_type: "client",
      entity_id: clientId,
      title: note.title,
      description: note.summary,
      metadata: { call_note_id: note.id, call_date: callDate, call_type: callType },
    });

    return json({ note });
  } catch (err) {
    console.error("nadia-notes error:", err instanceof Error ? err.message : err);
    return json({ error: "Internal error" }, 500);
  }
});