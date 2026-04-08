import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SUPA_SVC     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AGENT_SECRET = Deno.env.get("CW_AGENT_SECRET") || "crestwell-agent-2024";
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "https://portal.crestwelltravels.com",
  "Content-Type": "application/json",
};

const AGENTS = [
  { agent: "Tiara",      slug: "tiara",                 role: "Lead Qualification", method: "POST", expect401: true  },
  { agent: "Richard",    slug: "richard",               role: "Follow-up Sequence", method: "POST", expect401: true  },
  { agent: "Terrance",   slug: "terrance",              role: "Proposal Draft",     method: "POST", expect401: true  },
  { agent: "Chris",      slug: "chris",                 role: "Pre-trip Nurture",   method: "POST", expect401: true  },
  { agent: "Kandi",      slug: "kandi",                 role: "Reconciliation",     method: "POST", expect401: true  },
  { agent: "Google Ads", slug: "google-ads-conversion", role: "Ads Conversion",     method: "POST", expect401: true  },
  { agent: "Portal DB",  slug: "portal-leads",          role: "DB Connectivity",    method: "GET",  expect401: false },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const incomingSecret = req.headers.get("x-agent-secret") ?? "";
  if (incomingSecret !== AGENT_SECRET) {
    return new Response("Unauthorized", { status: 401, headers: CORS });
  }

  const results: any[] = [];
  const checkedAt = new Date().toISOString();

  for (const a of AGENTS) {
    const start = Date.now();
    try {
      const fetchOpts: RequestInit = {
        method: a.method,
        headers: {
          "Content-Type": "application/json",
          // Agents: send a bad secret so they return 401 (proves they are alive + secured)
          // portal-leads: send no secret header (GET endpoint, no auth needed)
          ...(a.method === "POST" ? { "x-agent-secret": "probe-no-secret" } : {}),
          "Origin": "https://portal.crestwelltravels.com",
        },
        signal: AbortSignal.timeout(8000),
        ...(a.method === "POST" ? { body: JSON.stringify({}) } : {}),
      };

      const res = await fetch(`${SUPA_URL}/functions/v1/${a.slug}`, fetchOpts);
      const latency = Date.now() - start;

      let responseText = "";
      try { responseText = await res.text(); } catch { responseText = ""; }
      responseText = responseText.slice(0, 120);

      let status: "ok" | "fail";
      if (a.expect401) {
        // 401 = secured & alive (probe used bad secret intentionally)
        // 400 = alive, auth not fully enforced but function is running
        status = res.status === 401 || res.status === 400 ? "ok" : "fail";
      } else {
        // portal-leads GET: 200 = healthy
        status = res.status === 200 ? "ok" : "fail";
      }

      // Portal DB: parse lead count from response
      if (a.slug === "portal-leads" && res.status === 200) {
        try {
          const d = JSON.parse(responseText);
          responseText = `${d.total ?? "?"} leads in DB`;
        } catch { /* keep raw */ }
      }

      results.push({
        agent: a.agent, slug: a.slug, role: a.role,
        status, http_code: res.status, latency_ms: latency, response: responseText,
      });
    } catch (e) {
      results.push({
        agent: a.agent, slug: a.slug, role: a.role,
        status: "fail", http_code: 0, latency_ms: Date.now() - start, response: String(e).slice(0, 120),
      });
    }
  }

  const healthy = results.filter(r => r.status === "ok").length;
  const failed  = results.filter(r => r.status === "fail").length;
  const all_ok  = failed === 0;

  // Email Tim if any agents are down
  let email_sent = false, email_id = "";
  if (!all_ok && RESEND_KEY) {
    const failList = results
      .filter(r => r.status === "fail")
      .map(r => `• ${r.agent} (${r.role}) — HTTP ${r.http_code}: ${r.response}`)
      .join("\n");

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Crestwell AI <noreply@crestwellgetaways.com>",
        to: "info@crestwellgetaways.com",
        subject: `⚠️ Agent Health Alert — ${failed}/${results.length} agents down`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#0d1b2a;padding:20px 28px">
            <span style="color:#c9a84c;font-size:1rem">Crestwell AI Health Monitor</span>
          </div>
          <div style="padding:24px;background:#faf8f3">
            <h2 style="color:#dc2626;font-weight:400;margin:0 0 16px">⚠️ ${failed} Agent${failed > 1 ? "s" : ""} Down</h2>
            <p style="font-family:monospace;font-size:0.85rem;white-space:pre;color:#374151">${failList}</p>
            <p style="font-size:0.8rem;color:#64748b;margin-top:16px">Checked at: ${checkedAt}</p>
          </div>
        </div>`,
      }),
    }).catch(() => null);

    if (emailRes?.ok) {
      const ed = await emailRes.json();
      email_sent = true;
      email_id = ed.id ?? "";
    }
  }

  return new Response(
    JSON.stringify({ ok: true, checked_at: checkedAt, total: results.length, healthy, failed, all_ok, email_sent, email_id, results }),
    { headers: CORS }
  );
});
