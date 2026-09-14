import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  material_id: z.string().uuid(),
  lesson_id: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const SYSTEM_PROMPT = `You are the curriculum editor for CTN Travel Academy, the internal training program of Crestwell Travel Network.
Turn the supplied official source material into a substantial, practical lesson for independent travel advisors.

Rules:
- Use only facts supported by SOURCE MATERIAL. Never invent policies, prices, legal requirements, supplier rules, dates, or procedures.
- Preserve CTN terminology and all meaningful operational details.
- Write polished Markdown with a short opening, clear ## sections, practical examples when the source supports them, a ## Key takeaways section, and a ## Check your understanding section with 3 questions.
- Do not mention that AI wrote or summarized the lesson.
- Do not call source content a draft unless the source itself is provisional.
- If a point is ambiguous, legally sensitive, or incomplete, add a visible blockquote beginning **Staff review required:** rather than guessing.
- Avoid generic encouragement and filler. The lesson should read like a real course, not a summary.
- Return only the Markdown lesson body.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!url || !anonKey || !serviceKey || !aiKey) return json({ error: "Service is not configured" }, 500);

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData } = await userClient.auth.getUser();
    if (!authData.user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(url, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", authData.user.id);
    const allowed = (roles || []).some((row: { role: string }) => row.role === "admin" || row.role === "office_admin");
    if (!allowed) return json({ error: "Staff access required" }, 403);

    const { material_id: materialId, lesson_id: lessonId } = parsed.data;
    const [{ data: material, error: materialError }, { data: lesson, error: lessonError }] = await Promise.all([
      admin.from("academy_source_materials").select("id, file_name, extracted_text, lesson_ids").eq("id", materialId).single(),
      admin.from("training_lessons").select("id, title, description, module_id, training_modules_v2(title)").eq("id", lessonId).single(),
    ]);
    if (materialError || lessonError || !material || !lesson) return json({ error: "Material or lesson was not found" }, 404);
    if (!(material.lesson_ids || []).includes(lessonId)) return json({ error: "This material is not assigned to that lesson" }, 400);
    const source = String(material.extracted_text || "").trim();
    if (source.length < 100) return json({ error: "The source file has no usable text" }, 422);

    await Promise.all([
      admin.from("academy_source_materials").update({ status: "processing", error_message: null }).eq("id", materialId),
      admin.from("academy_material_lesson_drafts").update({ status: "processing", error_message: null }).eq("material_id", materialId).eq("lesson_id", lessonId),
    ]);

    const moduleTitle = Array.isArray(lesson.training_modules_v2)
      ? lesson.training_modules_v2[0]?.title
      : (lesson.training_modules_v2 as { title?: string } | null)?.title;
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": aiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "medium",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `MODULE: ${moduleTitle || "CTN Travel Academy"}\nLESSON: ${lesson.title}\nLESSON PURPOSE: ${lesson.description || "Not provided"}\nSOURCE FILE: ${material.file_name}\n\nSOURCE MATERIAL:\n${source.slice(0, 120000)}` },
        ],
      }),
    });
    if (!aiResponse.ok) throw new Error(`Course generation failed (${aiResponse.status})`);
    const aiJson = await aiResponse.json();
    const draft = String(aiJson?.choices?.[0]?.message?.content || "").replace(/^```markdown\s*|```$/g, "").trim();
    if (draft.length < 500) throw new Error("The generated course draft was incomplete");

    const { error: updateError } = await admin.from("academy_material_lesson_drafts")
      .update({ generated_draft: draft, status: "ready", error_message: null })
      .eq("material_id", materialId).eq("lesson_id", lessonId);
    if (updateError) throw updateError;
    await admin.from("academy_source_materials").update({ status: "ready", error_message: null }).eq("id", materialId);
    return json({ draft });
  } catch (error) {
    console.error("generate-academy-lesson", error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : "Could not generate the course draft" }, 500);
  }
});