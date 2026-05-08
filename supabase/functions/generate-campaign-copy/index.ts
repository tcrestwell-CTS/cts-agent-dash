// =============================================================================
// supabase/functions/generate-campaign-copy/index.ts
// AI assistant for the Marketing Campaigns editor. Returns subject lines,
// body HTML, or an "improve" rewrite. Admin/office_admin only.
// =============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are an expert email marketing copywriter for Crestwell Travel Services, a luxury travel agency specializing in cruises, all-inclusive resorts, Disney vacations, and curated international experiences.

Brand voice: warm, refined, knowledgeable, aspirational but never pushy. Think "trusted concierge" not "discount hawker". Use vivid sensory language for destinations.

Always:
- Address the recipient using {{first_name}} when natural ("Hi {{first_name}},")
- Include a clear single call-to-action
- Keep paragraphs short (2-3 sentences)
- For HTML output: use ONLY simple, email-safe inline HTML (<p>, <h2>, <a>, <strong>, <em>, <ul>, <li>, <img>). No <script>, no <style> tags, no external CSS classes. Use inline style attributes only when necessary.
- Never invent specific prices, dates, or itineraries unless the user provides them
- Sign off as "The Crestwell Travel Team" unless told otherwise`;

async function callAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error(`AI gateway error: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) =>
    r.role === "admin" || r.role === "office_admin"
  );
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  let body: {
    mode?: "subjects" | "body" | "improve";
    topic?: string;
    tone?: string;
    cta?: string;
    audience?: string;
    selection?: string;
    instruction?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const tone = body.tone ?? "Luxury";
  const audience = body.audience ?? "past and prospective travel clients";

  try {
    if (body.mode === "subjects") {
      const prompt = `Write 5 high-performing email subject lines for this campaign.
Topic: ${body.topic || "(general newsletter)"}
Tone: ${tone}
Audience: ${audience}
CTA: ${body.cta || "(none specified)"}

Return ONLY a numbered list (1. ... 2. ... etc), no preamble, no quotes around lines. Each subject under 60 characters. Mix curiosity, value, and urgency styles.`;
      const out = await callAI([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ]);
      const subjects = out
        .split("\n")
        .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").replace(/^["']|["']$/g, "").trim())
        .filter((l) => l.length > 0 && l.length < 120)
        .slice(0, 5);
      return json({ subjects });
    }

    if (body.mode === "improve") {
      const prompt = `Improve the following email content. Keep the same intent and structure but make it more compelling, on-brand for Crestwell Travels (luxury, refined), and ensure it includes a clear CTA. Return ONLY the rewritten content, no commentary.

Instruction: ${body.instruction || "Make it stronger and more on-brand."}

Original:
${body.selection || ""}`;
      const out = await callAI([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ]);
      return json({ content: out.trim() });
    }

    // body
    const prompt = `Write a complete email body in semantic email-safe HTML.
Topic: ${body.topic || "(general newsletter)"}
Tone: ${tone}
Audience: ${audience}
Call-to-action: ${body.cta || "Reply to start planning"}

Structure:
- Opening greeting using {{first_name}}
- Hook paragraph that sets the scene
- 1-2 short value paragraphs (use <h2> for section heads if needed)
- Optional <ul> with 3 highlights
- Strong CTA paragraph with one <a href="https://crestwellgetaways.com">link</a> placeholder
- Sign-off

Return ONLY the inner HTML (no <html>, <head>, <body> wrappers). Use inline styles sparingly.`;
    const out = await callAI([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ]);
    // Strip markdown code fences if model added them
    const cleaned = out.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
    return json({ html: cleaned });
  } catch (err) {
    console.error("generate-campaign-copy error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});