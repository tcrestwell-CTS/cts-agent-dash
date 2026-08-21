// =============================================================================
// parse-itinerary-document — Edge Function
// Converts the extracted text of an imported itinerary document (PDF, Word, or
// plain text) into structured, day-numbered itinerary items for agent review.
// Nothing is written to the database — the agent approves items in the UI.
// =============================================================================

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

const CATEGORIES = [
  "flight", "hotel", "cruise", "transportation", "dining",
  "activity", "sightseeing", "relaxation", "shopping", "entertainment",
];

const SYSTEM_PROMPT =
  `You convert travel itinerary documents (supplier itineraries, tour operator PDFs, agent worksheets) into structured itinerary items for a travel agency CRM.

Rules:
- Use ONLY facts present in the document. Never invent flights, hotels, times, prices or confirmation numbers.
- One item per discrete component or scheduled activity (each flight segment, hotel check-in/out, port day, excursion, transfer, meal, free time block).
- Keep the document's chronological order.
- day_number is the 1-based trip day the item belongs to. Derive it from headings like "Day 3" or from dates relative to the trip departure date when given. Default to 1 only when nothing indicates a day.
- category must be exactly one of: ${CATEGORIES.join(", ")}.
- date must be YYYY-MM-DD when the document states or implies a calendar date, otherwise null.
- start_time / end_time must be 24h HH:MM, otherwise null.
- item_price is a plain number only when a price for that component is stated, otherwise null.
- title is short and human-readable. description holds remaining useful detail.
- Also return trip_title (the itinerary's name if stated) and destination (main destination if stated).

Return ONLY valid JSON of this shape:
{"trip_title": string | null, "destination": string | null, "items": [{"day_number": number, "title": string, "category": string, "date": string | null, "start_time": string | null, "end_time": string | null, "location": string | null, "description": string | null, "flight_number": string | null, "departure_city_code": string | null, "arrival_city_code": string | null, "item_price": number | null, "confirmation_number": string | null}]}`;

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
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const text: string = typeof body?.document_text === "string" ? body.document_text.trim() : "";
    const fileName: string | null = typeof body?.file_name === "string" ? body.file_name.slice(0, 200) : null;
    const departDate: string | null = body?.depart_date ?? null;
    const returnDate: string | null = body?.return_date ?? null;
    const totalDays: number = Number.isFinite(body?.total_days) ? Number(body.total_days) : 0;

    if (text.length < 40) {
      return json({ error: "No readable text was found in that document. If it is a scan, try a text-based PDF or paste the itinerary." }, 400);
    }
    const truncated = text.slice(0, 120000);

    const context = [
      fileName ? `Document file name: ${fileName}` : null,
      departDate ? `Trip departure date: ${departDate}` : null,
      returnDate ? `Trip return date: ${returnDate}` : null,
      totalDays > 0 ? `The trip spans ${totalDays} day(s); day_number must be between 1 and ${totalDays}.` : null,
    ].filter(Boolean).join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${context ? context + "\n\n" : ""}Itinerary document text:\n\n${truncated}` },
        ],
      }),
    });

    if (aiRes.status === 429) return json({ error: "AI is rate limited right now. Try again in a moment." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits are exhausted. Add credits to continue." }, 402);
    if (!aiRes.ok) {
      const detail = await aiRes.text();
      console.error("AI gateway error", aiRes.status, detail.slice(0, 400));
      return json({ error: "Could not parse the document. Please try again." }, 502);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(String(raw).replace(/```json\n?|```/g, "").trim());
    } catch {
      console.error("JSON parse failed for itinerary document parse");
      return json({ error: "Could not read the parsed result. Please try again." }, 502);
    }

    const maxDay = totalDays > 0 ? totalDays : 60;
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const cleaned = items
      .filter((i: any) => i && typeof i.title === "string" && i.title.trim())
      .map((i: any) => {
        const day = Number(i.day_number);
        return {
          day_number: Number.isFinite(day) ? Math.min(Math.max(Math.round(day), 1), maxDay) : 1,
          title: String(i.title).trim().slice(0, 200),
          category: CATEGORIES.includes(i.category) ? i.category : "activity",
          date: typeof i.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.date) ? i.date : null,
          start_time: typeof i.start_time === "string" && /^\d{2}:\d{2}/.test(i.start_time)
            ? i.start_time.slice(0, 5) : null,
          end_time: typeof i.end_time === "string" && /^\d{2}:\d{2}/.test(i.end_time)
            ? i.end_time.slice(0, 5) : null,
          location: i.location ? String(i.location).slice(0, 200) : null,
          description: i.description ? String(i.description).slice(0, 2000) : null,
          flight_number: i.flight_number ? String(i.flight_number).slice(0, 20) : null,
          departure_city_code: i.departure_city_code
            ? String(i.departure_city_code).toUpperCase().slice(0, 4) : null,
          arrival_city_code: i.arrival_city_code
            ? String(i.arrival_city_code).toUpperCase().slice(0, 4) : null,
          item_price: typeof i.item_price === "number" && isFinite(i.item_price) ? i.item_price : null,
          confirmation_number: i.confirmation_number ? String(i.confirmation_number).slice(0, 60) : null,
        };
      });

    if (cleaned.length === 0) {
      return json({ error: "No itinerary items were found in that document." }, 422);
    }

    return json({
      trip_title: parsed.trip_title ? String(parsed.trip_title).slice(0, 200) : null,
      destination: parsed.destination ? String(parsed.destination).slice(0, 200) : null,
      items: cleaned,
    });
  } catch (err) {
    console.error("parse-itinerary-document error:", err instanceof Error ? err.message : err);
    return json({ error: "Internal error" }, 500);
  }
});
