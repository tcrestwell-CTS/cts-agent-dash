import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Looks up a free-to-use photo (Wikimedia/Wikipedia page image) for a place or landmark. */
async function findPhoto(query: string): Promise<string | null> {
  if (!query || !query.trim()) return null;
  try {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*" +
      "&generator=search&gsrlimit=1&gsrnamespace=0" +
      `&gsrsearch=${encodeURIComponent(query.trim())}` +
      "&prop=pageimages&piprop=thumbnail&pithumbsize=1000";
    const res = await fetch(url, { headers: { "User-Agent": "CrestwellTravels/1.0 (itinerary photos)" } });
    if (!res.ok) return null;
    const json = await res.json();
    const pages = json?.query?.pages ? Object.values(json.query.pages) : [];
    for (const p of pages as any[]) {
      const src = p?.thumbnail?.source;
      if (typeof src === "string" && src.startsWith("https://")) return src;
    }
    return null;
  } catch (_e) {
    return null;
  }
}

/** Attaches photos to items that look visual (sights/activities), with limited concurrency. */
async function attachPhotos(items: any[], destination?: string) {
  const PHOTO_CATEGORIES = new Set(["sightseeing", "activity", "entertainment", "relaxation", "shopping", "dining", "cruise", "hotel"]);
  const candidates = items.filter((it) => PHOTO_CATEGORIES.has(String(it?.category || "").toLowerCase()));
  const limited = candidates.slice(0, 12);
  const BATCH = 4;
  for (let i = 0; i < limited.length; i += BATCH) {
    const batch = limited.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (item) => {
        const query =
          item.photo_query ||
          [item.location || item.title, destination].filter(Boolean).join(" ");
        const photo = await findPhoto(query);
        if (photo) item.image_url = photo;
        delete item.photo_query;
      })
    );
  }
  for (const it of items) delete it.photo_query;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { destination, departDate, returnDate, tripName, existingBookings, preferences } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const bookingsContext = existingBookings?.length
      ? `\nExisting bookings to incorporate:\n${existingBookings.map((b: any) => 
          `- ${b.trip_name || b.destination} (${b.suppliers?.supplier_type || 'booking'}): ${b.depart_date} to ${b.return_date}`
        ).join('\n')}`
      : '';

    const systemPrompt = `You are a professional travel itinerary planner for a travel agency. Create detailed, day-by-day itineraries that are practical, well-paced, and informative.

Your response MUST be a valid JSON array of itinerary items. Each item must have:
- day_number (integer, starting from 1)
- title (string, concise activity name)
- description (string, 1-2 sentences about the activity)
- category (one of: "flight", "hotel", "cruise", "transportation", "dining", "activity", "sightseeing", "relaxation", "shopping", "entertainment")
- location (string, specific location name)
- start_time (string HH:MM format, 24hr)
- end_time (string HH:MM format, 24hr)
- photo_query (string) — for visual items (sightseeing, activities, landmarks, hotels, restaurants), the most likely Wikipedia article title for the specific place (e.g. "Colosseum", "Sagrada Família", "Central Park"). Use an empty string when the item is generic (e.g. "free time", "check in").

Create a realistic, well-paced itinerary with 4-6 items per day. Include meals, travel time, and downtime. Do NOT include any markdown formatting, code blocks, or explanation — ONLY the JSON array.`;

    const userPrompt = `Create a detailed day-by-day itinerary for:
- Trip: ${tripName || 'Vacation'}
- Destination: ${destination || 'Unknown'}
- Dates: ${departDate || 'TBD'} to ${returnDate || 'TBD'}
${preferences ? `- Preferences: ${preferences}` : ''}${bookingsContext}

Return ONLY a JSON array of itinerary items.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parse the JSON from the response, handling potential markdown wrapping
    let items;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      items = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      items = [];
    }

    if (Array.isArray(items) && items.length) {
      await attachPhotos(items, destination);
    }

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-itinerary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
