// Notifies the assigned advisor (and the agency owner) that a lead landed on
// their storefront / was assigned to them. Public: takes only a lead id and
// resolves everything else server-side with the service role.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveAgentBranding } from "../_shared/agent-branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

async function sendMail(payload: Record<string, unknown>) {
  if (!RESEND_API_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error("resend error", res.status, await res.text());
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { lead_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.lead_id) return json({ error: "lead_id is required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: lead } = await admin
    .from("quote_requests")
    .select(
      "id, first_name, last_name, email, phone, destination, trip_type, departure_date, budget, lead_source, assigned_agent_id",
    )
    .eq("id", body.lead_id)
    .maybeSingle();

  if (!lead) return json({ error: "Lead not found" }, 404);

  const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "New lead";
  const leadUrl = `https://app.crestwelltravels.com/leads?lead=${lead.id}`;
  const detailRows = `
    <p style="margin:4px 0;"><strong>Email:</strong> ${lead.email ?? "—"}</p>
    <p style="margin:4px 0;"><strong>Phone:</strong> ${lead.phone ?? "—"}</p>
    <p style="margin:4px 0;"><strong>Destination:</strong> ${lead.destination ?? "—"}</p>
    <p style="margin:4px 0;"><strong>Trip type:</strong> ${lead.trip_type ?? "—"}</p>
    <p style="margin:4px 0;"><strong>Departure:</strong> ${lead.departure_date ?? "—"}</p>
    <p style="margin:4px 0;"><strong>Budget:</strong> ${lead.budget ?? "—"}</p>
    <p style="margin:4px 0;"><strong>Source:</strong> ${lead.lead_source ?? "—"}</p>
  `;

  // Agency owner always gets a copy.
  const { data: ownerBranding } = await admin
    .from("branding_settings")
    .select("email_address")
    .not("email_address", "is", null)
    .limit(1)
    .maybeSingle();
  const ownerEmail = Deno.env.get("AGENCY_ADMIN_EMAIL") || ownerBranding?.email_address || null;

  let agentNotified = false;
  let ownerNotified = false;

  if (lead.assigned_agent_id) {
    const brand = await resolveAgentBranding(admin, lead.assigned_agent_id);

    await admin.from("agent_notifications").insert({
      user_id: lead.assigned_agent_id,
      type: "lead_assigned",
      title: "New lead assigned to you",
      message: `${leadName}${lead.destination ? ` — ${lead.destination}` : ""}`,
    });

    const { data: agentUser } = await admin.auth.admin.getUserById(lead.assigned_agent_id);
    const agentEmail = brand.replyTo || agentUser?.user?.email;
    if (agentEmail) {
      agentNotified = await sendMail({
        from: brand.from,
        to: agentEmail,
        reply_to: brand.replyTo,
        subject: `New lead assigned: ${leadName}`,
        html: `<h2>${leadName}</h2>${detailRows}<p><a href="${leadUrl}">Open the lead</a></p>`,
      });
    }

    if (ownerEmail && ownerEmail.toLowerCase() !== String(agentEmail ?? "").toLowerCase()) {
      ownerNotified = await sendMail({
        from: "Crestwell Travel <send@crestwellgetaways.com>",
        to: ownerEmail,
        subject: `Lead assigned to ${brand.advisorName}: ${leadName}`,
        html: `<h2>${leadName}</h2><p>Assigned to <strong>${brand.advisorName}</strong> (${brand.agencyName}).</p>${detailRows}<p><a href="${leadUrl}">Open the lead</a></p>`,
      });
    }
  } else if (ownerEmail) {
    // Unassigned (crestwellgetaways.com) leads go to the owner only.
    ownerNotified = await sendMail({
      from: "Crestwell Travel <send@crestwellgetaways.com>",
      to: ownerEmail,
      subject: `New unassigned lead: ${leadName}`,
      html: `<h2>${leadName}</h2><p>This lead came in unassigned and stays with you until you assign it.</p>${detailRows}<p><a href="${leadUrl}">Open the lead</a></p>`,
    });
  }

  return json({ ok: true, agentNotified, ownerNotified });
});
