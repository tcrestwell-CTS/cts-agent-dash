// =============================================================================
// supabase/functions/resend-webhook/index.ts
// Receives delivery events from Resend, updates recipient state and
// campaign aggregate stats. Auto-suppresses bounces and complaints.
// Configure in Resend dashboard with secret = RESEND_WEBHOOK_SECRET.
// =============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Webhook } from "npm:svix@1.32.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const wh = new Webhook(WEBHOOK_SECRET);

type EventMapping = {
  statField?: string;
  recipientStatus?: string;
  timestampField?: string;
  counterField?: string;
};

const EVENT_MAP: Record<string, EventMapping> = {
  "email.sent":       { statField: "total_sent",       recipientStatus: "sent",       timestampField: "sent_at" },
  "email.delivered":  { statField: "total_delivered",  recipientStatus: "delivered",  timestampField: "delivered_at" },
  "email.opened":     { statField: "total_opened",     recipientStatus: "opened",     timestampField: "first_opened_at",  counterField: "open_count" },
  "email.clicked":    { statField: "total_clicked",    recipientStatus: "clicked",    timestampField: "first_clicked_at", counterField: "click_count" },
  "email.bounced":    { statField: "total_bounced",    recipientStatus: "bounced",    timestampField: "bounced_at" },
  "email.complained": { statField: "total_complained", recipientStatus: "complained", timestampField: "complained_at" },
};

const STATUS_ORDER = ["queued", "sent", "delivered", "opened", "clicked"];

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };
  const rawBody = await req.text();

  let event: any;
  try {
    event = wh.verify(rawBody, headers);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 401 });
  }

  const eventType: string = event.type;
  const data = event.data ?? {};
  const resendId: string | undefined = data.email_id;
  const recipientEmail: string = ((Array.isArray(data.to) ? data.to[0] : data.to) ?? "").toLowerCase();
  const tags: Array<{ name: string; value: string }> = data.tags ?? [];
  const campaignId = tags.find((t) => t.name === "campaign_id")?.value;

  if (!campaignId) {
    console.log("Webhook without campaign_id tag:", eventType, resendId);
    return new Response("OK (not a campaign event)", { status: 200 });
  }

  try {
    const { data: recipient } = await supabase
      .from("campaign_recipients")
      .select("id, status, open_count, click_count, first_opened_at, first_clicked_at")
      .eq("campaign_id", campaignId)
      .eq("email", recipientEmail)
      .maybeSingle();

    // Forensic event log
    await supabase.from("campaign_events").insert({
      campaign_id: campaignId,
      recipient_id: recipient?.id ?? null,
      resend_id: resendId,
      event_type: eventType,
      payload: event,
    });

    const mapping = EVENT_MAP[eventType];
    if (!mapping) return new Response("OK (event logged)", { status: 200 });

    let isFirstTimeOpenClick = false;

    if (recipient) {
      const update: Record<string, unknown> = {};
      const now = new Date().toISOString();

      if (mapping.recipientStatus) {
        const ns = mapping.recipientStatus;
        if (ns === "bounced" || ns === "complained") {
          update.status = ns;
        } else {
          const newOrder = STATUS_ORDER.indexOf(ns);
          const curOrder = STATUS_ORDER.indexOf(recipient.status);
          if (newOrder > -1 && curOrder > -1 && newOrder > curOrder) {
            update.status = ns;
          }
        }
      }

      if (mapping.timestampField) {
        const tf = mapping.timestampField;
        if (tf === "first_opened_at" || tf === "first_clicked_at") {
          if (!(recipient as any)[tf]) {
            update[tf] = now;
            isFirstTimeOpenClick = true;
          }
        } else {
          update[tf] = now;
        }
      }

      if (mapping.counterField) {
        update[mapping.counterField] =
          ((recipient as any)[mapping.counterField] ?? 0) + 1;
      }

      if (eventType === "email.bounced") {
        update.bounce_reason = data.bounce?.message ?? data.reason ?? "unknown";
      }

      if (Object.keys(update).length > 0) {
        await supabase
          .from("campaign_recipients")
          .update(update)
          .eq("id", recipient.id);
      }

      if (eventType === "email.bounced" || eventType === "email.complained") {
        await supabase.from("email_suppressions").upsert(
          {
            email: recipientEmail,
            reason: eventType === "email.bounced" ? "bounced" : "complained",
            source: `campaign:${campaignId}`,
            notes: data.bounce?.message ?? null,
          },
          { onConflict: "email" },
        );
      }
    }

    if (mapping.statField) {
      const incrementOnce =
        eventType === "email.opened" || eventType === "email.clicked";
      if (!incrementOnce || isFirstTimeOpenClick) {
        await supabase.rpc("increment_campaign_stat", {
          p_campaign_id: campaignId,
          p_field: mapping.statField,
          p_delta: 1,
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response("Logged with errors", { status: 200 });
  }
});