// Per-item / per-day AI helpers for the itinerary builder.
// Actions: "describe" (rewrite one item's description), "suggest" (3 activity ideas
// for a day), "fill_day" (a full, paced day plan). Returns JSON; the client decides
// what to insert — nothing is written to the database here.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MODEL = "openai/gpt-6-astra";
const CATEGORIES = ["flight", "hotel", "cruise", "transportation", "dining", "activity", "sightseeing", "relaxation", "shopping", "entertainment"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Streams a Responses call and returns the accumulated output text. */
async function runModel(apiKey: string, system: string, user: string, signal: AbortSignal) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      instructions: system,
      input: user,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });
  if (!res.ok || !res.body) {
    let message = `AI request failed (${res.status})`;
    try { const j = await res.json(); message = j?.error?.message || j?.message || message; } catch { /* ignore */ }
    return { status: res.status, error: message, text: "" };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", streamErr = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        else if (ev.type === "error" || ev.type === "response.failed") streamErr = ev.error?.message || ev.response?.error?.message || "AI request failed";
      } catch { /* partial */ }
    }
  }
  if (streamErr) return { status: 502, error: streamErr, text };
  return { status: 200, error: "", text };
}

function extractJson(text: string): any {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[\[{]/);
  if (start < 0) throw new Error("No JSON in response");
  return JSON.parse(cleaned.slice(start, Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}")) + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (!u?.user) return json({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured" }, 500);

    const { action, destination, tripName, dayNumber, date, item, dayItems = [], instructions } = await req.json();
    if (!["describe", "suggest", "fill_day"].includes(action)) return json({ error: "Unknown action" }, 400);

    const ctx = [
      tripName && `Trip: ${tripName}`,
      destination && `Destination: ${destination}`,
      dayNumber && `Day ${dayNumber}${date ? ` (${date})` : ""}`,
      dayItems.length && `Already planned that day:\n${dayItems.map((d: any) => `- ${d.start_time || "--:--"} ${d.title}${d.location ? ` @ ${d.location}` : ""}`).join("\n")}`,
      instructions && `Advisor notes: ${String(instructions).slice(0, 500)}`,
    ].filter(Boolean).join("\n");

    const system = "You write for Crestwell Travels, a luxury travel agency. Warm, specific, factual; no emoji, no hype, no invented prices or bookings. Output only what is asked, with no markdown fences.";
    let prompt: string;
    if (action === "describe") {
      prompt = `${ctx}\n\nItem: ${item?.title}${item?.location ? ` at ${item.location}` : ""} (${item?.category || "activity"}).\nCurrent description: ${item?.description || "(none)"}\n\nWrite a client-facing description of 2-3 sentences (max 70 words). Return JSON: {"description": "..."}`;
    } else {
      const n = action === "suggest" ? "exactly 3 optional activity ideas that fit around what is already planned" : "a complete, well-paced plan of 4-6 items for the day, not duplicating what is already planned";
      prompt = `${ctx}\n\nSuggest ${n}. Return a JSON array; each element: {"title","description" (1-2 sentences),"category" (one of ${CATEGORIES.join(", ")}),"location","start_time" (HH:MM 24h),"end_time" (HH:MM 24h)}.`;
    }

    const r = await runModel(apiKey, system, prompt, req.signal);
    if (r.error) return json({ error: r.error }, r.status >= 400 ? r.status : 502);
    if (!r.text.trim()) return json({ error: "The AI returned an empty response" }, 502);

    let parsed: any;
    try { parsed = extractJson(r.text); } catch { return json({ error: "Could not read the AI response" }, 502); }

    if (action === "describe") {
      const description = String(parsed?.description || "").trim();
      if (!description) return json({ error: "No description returned" }, 502);
      return json({ description });
    }
    const items = (Array.isArray(parsed) ? parsed : parsed?.items || [])
      .filter((i: any) => i?.title)
      .slice(0, 6)
      .map((i: any) => ({
        title: String(i.title).slice(0, 200),
        description: i.description ? String(i.description) : null,
        category: CATEGORIES.includes(String(i.category).toLowerCase()) ? String(i.category).toLowerCase() : "activity",
        location: i.location ? String(i.location) : null,
        start_time: /^\d{2}:\d{2}$/.test(i.start_time) ? i.start_time : null,
        end_time: /^\d{2}:\d{2}$/.test(i.end_time) ? i.end_time : null,
      }));
    return json({ items });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error("itinerary-ai-action error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
