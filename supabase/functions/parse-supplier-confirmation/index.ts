// =============================================================================
// parse-supplier-confirmation — Edge Function
// Converts a pasted supplier confirmation email (air, hotel, cruise, transfer,
// tour) into structured itinerary items for agent review. Nothing is written to
// the database here — the agent approves items in the UI before insert.
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
  `You convert supplier confirmation emails into travel itinerary items for a travel agency CRM.

Rules:
- Use ONLY facts present in the email. Never invent flight numbers, times, prices, hotels or confirmation numbers.
- One item per discrete travel component: each flight segment, each hotel stay, each cruise segment/port day, each transfer, each tour or dining reservation.
- category must be exactly one of: ${CATEGORIES.join(", ")}.
- date must be YYYY-MM-DD when the email states a date, otherwise null.
- start_time / end_time must be 24h HH:MM, otherwise null.
- item_price is a plain number (no symbols) only when the email states a price for that component, otherwise null.
- flight_number / departure_city_code / arrival_city_code only for flights (3-letter IATA codes where given).
- confirmation_number is the supplier reference tied to that component when present.
- title is short and human-readable, e.g. "Delta 1423 ATL to MCO" or "Check-in: Hyatt Regency Orlando".
- description holds the useful remaining detail (room type, cabin, fare, inclusions, cancellation notes).
- ADX / Travel Edge / Ensemble confirmations may bundle several components (air + hotel + transfer) under one booking reference. Split each component into its own item, set supplier to "ADX (Travel Edge)", put the ADX booking reference in record_locator, and include the underlying vendor and any stated commission amount or rate in description.

Return ONLY valid JSON of this shape:
{"supplier": string | null, "record_locator": string | null, "items": [{"title": string, "category": string, "date": string | null, "start_time": string | null, "end_time": string | null, "location": string | null, "description": string | null, "flight_number": string | null, "departure_city_code": string | null, "arrival_city_code": string | null, "item_price": number | null, "confirmation_number": string | null}]}`;

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
    const email: string = typeof body?.email_text === "string" ? body.email_text.trim() : "";
    const departDate: string | null = body?.depart_date ?? null;
    const returnDate: string | null = body?.return_date ?? null;

    if (email.length < 40) {
      return json({ error: "Paste the full confirmation email so it can be parsed." }, 400);
    }
    if (email.length > 60000) {
      return json({ error: "That confirmation is too long. Paste the relevant section." }, 400);
    }

    const context = [
      departDate ? `Trip departure date: ${departDate}` : null,
      returnDate ? `Trip return date: ${returnDate}` : null,
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
          {
            role: "user",
            content: `${context ? context + "\n\n" : ""}Supplier confirmation email:\n\n${email}`,
          },
        ],
      }),
    });

    if (aiRes.status === 429) {
      return json({ error: "AI is rate limited right now. Try again in a moment." }, 429);
    }
    if (aiRes.status === 402) {
      return json({ error: "AI credits are exhausted. Add credits to continue." }, 402);
    }
    if (!aiRes.ok) {
      const detail = await aiRes.text();
      console.error("AI gateway error", aiRes.status, detail.slice(0, 400));
      return json({ error: "Could not parse the confirmation. Please try again." }, 502);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(String(raw).replace(/```json\n?|```/g, "").trim());
    } catch {
      console.error("JSON parse failed for confirmation parse");
      return json({ error: "Could not read the parsed result. Please try again." }, 502);
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const cleaned = items
      .filter((i: any) => i && typeof i.title === "string" && i.title.trim())
      .map((i: any) => ({
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
        confirmation_number: i.confirmation_number
          ? String(i.confirmation_number).slice(0, 60) : null,
      }));

    if (cleaned.length === 0) {
      return json({ error: "No itinerary components were found in that email." }, 422);
    }

    return json({
      supplier: parsed.supplier ? String(parsed.supplier).slice(0, 120) : null,
      record_locator: parsed.record_locator ? String(parsed.record_locator).slice(0, 60) : null,
      items: cleaned,
    });
  } catch (err) {
    console.error("parse-supplier-confirmation error:", err instanceof Error ? err.message : err);
    return json({ error: "Internal error" }, 500);
  }
});
