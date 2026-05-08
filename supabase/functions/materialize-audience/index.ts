// =============================================================================
// supabase/functions/materialize-audience/index.ts
// Expands a campaign_audiences.filter into campaign_recipients rows.
// Supported filter shapes (v1):
//   { type: "all_clients" }
//   { type: "all_leads" }
//   { type: "all_contacts" }       (clients + leads, deduped on email)
//   { type: "manual", emails: ["a@x.com", ...] }
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ContactRow = {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  contact_name?: string | null;
  source: "client" | "lead" | "manual";
  contact_id?: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const { data: roles } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) =>
    r.role === "admin" || r.role === "office_admin"
  );
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  let body: { campaignId?: string; audienceId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { campaignId, audienceId } = body;
  if (!campaignId || !audienceId)
    return json({ error: "campaignId and audienceId required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: audience, error: aErr } = await admin
      .from("campaign_audiences")
      .select("*")
      .eq("id", audienceId)
      .maybeSingle();
    if (aErr || !audience) return json({ error: "Audience not found" }, 404);

    const filter = (audience.filter ?? {}) as { type?: string; emails?: string[] };
    const type = filter.type ?? "all_contacts";

    const contacts: ContactRow[] = [];

    if (type === "all_clients" || type === "all_contacts") {
      const { data: clients } = await admin
        .from("clients")
        .select("id, name, email")
        .not("email", "is", null);
      for (const c of clients ?? []) {
        if (!c.email) continue;
        contacts.push({
          email: c.email,
          contact_name: c.name,
          source: "client",
          contact_id: c.id,
        });
      }
    }

    if (type === "all_leads" || type === "all_contacts") {
      const { data: leads } = await admin
        .from("quote_requests")
        .select("id, name, email")
        .not("email", "is", null);
      for (const l of leads ?? []) {
        if (!l.email) continue;
        contacts.push({
          email: l.email,
          contact_name: l.name,
          source: "lead",
          contact_id: l.id,
        });
      }
    }

    if (type === "manual") {
      for (const e of filter.emails ?? []) {
        if (typeof e === "string" && e.includes("@")) {
          contacts.push({ email: e.trim(), source: "manual" });
        }
      }
    }

    // Dedupe by lowercased email
    const byEmail = new Map<string, ContactRow>();
    for (const c of contacts) {
      const key = c.email.toLowerCase();
      if (!byEmail.has(key)) byEmail.set(key, c);
    }
    const unique = Array.from(byEmail.values());

    // Wipe existing queued rows for this campaign, then insert fresh
    await admin
      .from("campaign_recipients")
      .delete()
      .eq("campaign_id", campaignId)
      .in("status", ["queued", "suppressed"]);

    if (unique.length > 0) {
      const rows = unique.map((c) => {
        const parts = (c.contact_name ?? "").trim().split(/\s+/);
        const first_name = parts[0] ?? "";
        const last_name = parts.slice(1).join(" ");
        return {
          campaign_id: campaignId,
          contact_id: c.contact_id ?? null,
          contact_source: c.source,
          email: c.email,
          status: "queued",
          merge_data: {
            first_name,
            last_name,
            contact_name: c.contact_name ?? "",
          },
        };
      });
      // Insert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error: iErr } = await admin
          .from("campaign_recipients")
          .upsert(chunk, { onConflict: "campaign_id,email" });
        if (iErr) throw iErr;
      }
    }

    await admin
      .from("campaigns")
      .update({ total_recipients: unique.length, audience_id: audienceId })
      .eq("id", campaignId);

    await admin
      .from("campaign_audiences")
      .update({ contact_count: unique.length, last_counted_at: new Date().toISOString() })
      .eq("id", audienceId);

    return json({ ok: true, count: unique.length });
  } catch (err) {
    console.error("materialize-audience error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});