import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userData, error: userErr } = await admin.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  const actor = userData?.user;
  if (userErr || !actor) return json({ error: "Unauthorized" }, 401);

  let body: { leadId?: string; agentId?: string | null; notify?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const leadId = body.leadId;
  const agentId = body.agentId ?? null;
  const notify = body.notify !== false;
  if (!leadId) return json({ error: "leadId is required" }, 400);

  // Only admins/office admins may assign to someone else; anyone may claim for self.
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", actor.id);
  const isPrivileged = (roles || []).some((r: { role: string }) =>
    ["admin", "office_admin"].includes(r.role)
  );
  if (!isPrivileged && agentId !== actor.id) {
    return json({ error: "Not allowed to assign leads to other agents" }, 403);
  }

  const { data: lead, error: updateErr } = await admin
    .from("quote_requests")
    .update({
      assigned_agent_id: agentId,
      assigned_at: agentId ? new Date().toISOString() : null,
    })
    .eq("id", leadId)
    .select("id, first_name, last_name, email, phone, destination, trip_type, departure_date, budget, ai_score")
    .maybeSingle();

  if (updateErr) {
    console.error("assign-lead update error", updateErr);
    return json({ error: "Failed to assign lead" }, 500);
  }
  if (!lead) return json({ error: "Lead not found" }, 404);

  if (!agentId) return json({ ok: true, assigned: false, notified: false, adminNotified: false });

  const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "New lead";

  const { data: agentProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("user_id", agentId)
    .maybeSingle();

  // In-app notification
  await admin.from("agent_notifications").insert({
    user_id: agentId,
    type: "lead_assigned",
    title: "New lead assigned to you",
    message: `${leadName}${lead.destination ? ` — ${lead.destination}` : ""}`,
  });

  let notified = false;
  let adminNotified = false;
  if (notify) {
    const { data: agentUser } = await admin.auth.admin.getUserById(agentId);
    const agentEmail = agentUser?.user?.email;
    const leadEmailData = {
      agentName: agentProfile?.full_name || "there",
      leadName,
      leadEmail: lead.email || "—",
      leadPhone: lead.phone || "—",
      destination: lead.destination || "—",
      tripType: lead.trip_type || "—",
      departureDate: lead.departure_date || "—",
      budget: lead.budget ? String(lead.budget) : "—",
      leadScore: lead.ai_score != null ? String(lead.ai_score) : "—",
      leadUrl: `https://app.crestwelltravels.com/leads?lead=${lead.id}`,
    };
    if (agentEmail) {
      const { error: mailErr } = await admin.functions.invoke("send-email", {
        headers: { Authorization: authHeader },
        body: {
          to: agentEmail,
          subject: `New lead assigned: ${leadName}`,
          template: "lead_assigned",
          data: leadEmailData,
          idempotencyKey: `lead-assigned-agent:${lead.id}:${agentId}`,
        },
      });
      if (mailErr) console.error("assign-lead email error", mailErr);
      else notified = true;
    }

    // Owner/admin copy so the agency always sees assignments.
    const { data: adminBranding } = await admin
      .from("branding_settings")
      .select("email_address")
      .not("email_address", "is", null)
      .limit(1)
      .maybeSingle();
    const adminEmail =
      Deno.env.get("AGENCY_ADMIN_EMAIL") || adminBranding?.email_address || null;

    if (adminEmail && adminEmail.toLowerCase() !== (agentEmail || "").toLowerCase()) {
      const { error: adminMailErr } = await admin.functions.invoke("send-email", {
        headers: { Authorization: authHeader },
        body: {
          to: adminEmail,
          subject: `Lead assigned to ${agentProfile?.full_name || "advisor"}: ${leadName}`,
          template: "lead_assigned",
          data: { ...leadEmailData, agentName: agentProfile?.full_name || "Advisor" },
          idempotencyKey: `lead-assigned-admin:${lead.id}:${agentId}`,
        },
      });
      if (adminMailErr) console.error("assign-lead admin email error", adminMailErr);
      else adminNotified = true;
    }
  }

  return json({ ok: true, assigned: true, notified, adminNotified });
});
