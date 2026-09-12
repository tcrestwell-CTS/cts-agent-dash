// ctn-reconcile-log
// Safety net for the CTN signup payment flow: records Stripe checkout events
// that could NOT be matched to an application (or whose fulfillment failed)
// into public.ctn_approval_log, and alerts the admin by email so a mismatch is
// caught within a day instead of discovered weeks later.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const responseHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": "authorization, content-type, x-agent-secret",
  "Content-Type": "application/json",
};

const ALERT_TO = "tcrestwell@crestwellgetaways.com";

const RequestSchema = z.object({
  email: z.string().trim().max(320).optional(),
  application_id: z.string().uuid().optional(),
  action_type: z.enum(["unmatched_payment", "fulfillment_failed", "payment_pending", "payment_failed"]),
  stripe_event_id: z.string().trim().max(255).optional(),
  stripe_event_type: z.string().trim().max(100).optional(),
  stripe_customer_id: z.string().trim().max(255).optional(),
  stripe_checkout_session_id: z.string().trim().max(255).optional(),
  stripe_subscription_id: z.string().trim().max(255).optional(),
  payment_status: z.string().trim().max(50).optional(),
  match_method: z.string().trim().max(50).optional(),
  error: z.string().trim().max(2000).optional(),
  details: z.record(z.unknown()).optional(),
  alert: z.boolean().optional().default(true),
});

async function sendAlert(payload: z.infer<typeof RequestSchema>) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;

  const rows = [
    ["Issue", payload.action_type.replace(/_/g, " ")],
    ["Email used at checkout", payload.email || "(none provided)"],
    ["Application ID", payload.application_id || "(no match found)"],
    ["Stripe payment state", payload.payment_status || "unknown"],
    ["Match attempted by", payload.match_method || "email"],
    ["Stripe event", `${payload.stripe_event_type || ""} ${payload.stripe_event_id || ""}`.trim()],
    ["Checkout session", payload.stripe_checkout_session_id || "-"],
    ["Customer", payload.stripe_customer_id || "-"],
    ["Subscription", payload.stripe_subscription_id || "-"],
    ["Details", payload.error || "-"],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;">${k}</td><td style="font-size:13px;font-weight:600;">${v}</td></tr>`,
    )
    .join("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: "CTN System <agents@crestwellgetaways.com>",
      to: [ALERT_TO],
      subject: `[CTN Action Needed] Signup payment could not be completed automatically`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
        <div style="background:#0D1B2A;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="color:#C9A84C;margin:0;font-size:18px;">Agent signup needs manual review</h2>
        </div>
        <div style="padding:20px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
          <p style="font-size:14px;color:#374151;margin:0 0 16px;">A subscription payment event arrived but the agent account was not activated automatically. Review it and complete the account manually if the payment is genuinely paid.</p>
          <table style="width:100%;border-collapse:collapse;">${rows}</table>
        </div>
      </div>`,
    }),
  });
  if (!res.ok) console.error("[ctn-reconcile-log] alert email failed:", await res.text());
  return res.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: responseHeaders });

  const provided =
    req.headers.get("x-agent-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const valid = [Deno.env.get("CTN_APPROVE_SECRET"), Deno.env.get("CW_AGENT_SECRET")].filter(Boolean);
  if (!provided || !valid.includes(provided)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: responseHeaders });
  }

  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: responseHeaders,
      });
    }
    const input = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const record = {
      application_id: input.application_id || null,
      email: (input.email || "unknown@unmatched.local").toLowerCase(),
      action_type: input.action_type,
      source: "stripe_webhook",
      stripe_event_id: input.stripe_event_id || null,
      stripe_customer_id: input.stripe_customer_id || null,
      stripe_checkout_session_id: input.stripe_checkout_session_id || null,
      stripe_subscription_id: input.stripe_subscription_id || null,
      payment_status: input.payment_status || null,
      match_method: input.match_method || "email",
      status: input.action_type === "payment_pending" ? "pending_payment" : "needs_review",
      error: input.error || null,
      details: { ...(input.details || {}), stripe_event_type: input.stripe_event_type || null },
    };

    // Idempotent on the Stripe event when one is supplied.
    let logId: string | null = null;
    if (input.stripe_event_id) {
      const { data: prior } = await supabase
        .from("ctn_approval_log")
        .select("id, attempt_count")
        .eq("stripe_event_id", input.stripe_event_id)
        .maybeSingle();
      if (prior?.id) {
        const { error } = await supabase
          .from("ctn_approval_log")
          .update({ ...record, attempt_count: (prior.attempt_count || 0) + 1 })
          .eq("id", prior.id);
        if (error) throw new Error(error.message);
        logId = prior.id as string;
      }
    }

    if (!logId) {
      const { data, error } = await supabase
        .from("ctn_approval_log")
        .insert({ ...record, attempt_count: 1 })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      logId = data.id as string;
    }

    const alerted = input.alert ? await sendAlert(input) : false;
    return new Response(JSON.stringify({ success: true, log_id: logId, alerted }), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ctn-reconcile-log] Error:", msg);
    return new Response(JSON.stringify({ error: "Internal server error", detail: msg }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
