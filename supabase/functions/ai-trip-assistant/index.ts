import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(prompt: string) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return JSON.parse(content);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { type, destination, departDate, returnDate, activityTypes } = await req.json();

    if (type === "destination_guide") {
      if (!destination) throw new Error("destination required");
      const prompt = `You are a travel advisor. Generate a concise destination guide for "${destination}" for US travelers. Return ONLY valid JSON with this exact shape:
{
  "guide": {
    "destination": string,
    "overview": string (2-3 sentences),
    "weather": string (one line),
    "currency": string (name + symbol),
    "language": string,
    "timezone": string,
    "visa": string (entry requirements for US citizens, one line),
    "tips": string[] (4-5 practical local tips),
    "emergency": string (local emergency numbers)
  }
}`;
      const parsed = await callAI(prompt);
      const guide = parsed.guide ?? parsed;
      return new Response(JSON.stringify({ guide }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "packing_list") {
      const nights = departDate && returnDate
        ? Math.max(1, Math.round((new Date(returnDate).getTime() - new Date(departDate).getTime()) / 86400000))
        : 7;
      const prompt = `Generate a packing list for a ${nights}-night trip to ${destination || "an international destination"}${activityTypes?.length ? ` with activities: ${activityTypes.join(", ")}` : ""}. Return ONLY valid JSON:
{
  "packingList": [
    { "category": string, "icon": string (emoji), "items": string[] }
  ]
}
Include categories: Documents, Clothing, Toiletries, Electronics, Health & Safety, and relevant activity-specific gear.`;
      const parsed = await callAI(prompt);
      const packingList = parsed.packingList ?? parsed;
      return new Response(JSON.stringify({ packingList }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("ai-trip-assistant error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 200, // return 200 so client gets data.error instead of FunctionsHttpError
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});