// send-push-notification — called by DB triggers (portal_messages,
// trip_payments, client_document_uploads) via pg_net, service-role only.
// 1. Records the notification in client_notifications (feeds the mobile
//    app's Notifications screen even for clients with no device registered
//    or notifications disabled).
// 2. Delivers a real push via Expo's push service to every registered
//    device for that client.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-internal-secret",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Internal only — called by DB triggers with either the service-role key
    // or the shared PUSH_INTERNAL_SECRET, never directly by a client.
    const authHeader = req.headers.get("Authorization") ?? "";
    const internalHeader = req.headers.get("x-internal-secret") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = Deno.env.get("PUSH_INTERNAL_SECRET") ?? "";
    const authorized =
      authHeader === `Bearer ${serviceKey}` ||
      (internalSecret.length > 0 && internalHeader === internalSecret);
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const body = await req.json();
    const { client_id, type, title, body: messageBody, trip_id } = body;

    if (!client_id || !type || !title || !messageBody) {
      return new Response(JSON.stringify({ error: "client_id, type, title, and body are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Record it — this happens regardless of whether push delivery
    //    succeeds, so the in-app Notifications screen is always accurate.
    const { error: insertError } = await supabase.from("client_notifications").insert({
      client_id, type, title, body: messageBody, trip_id: trip_id ?? null,
    });
    if (insertError) {
      console.error("client_notifications insert error:", insertError);
    }

    // 2. Deliver push to every registered device for this client.
    const { data: tokens } = await supabase
      .from("client_push_tokens")
      .select("token")
      .eq("client_id", client_id);

    if (tokens && tokens.length > 0) {
      const messages = tokens.map((t: { token: string }) => ({
        to: t.token,
        sound: "default",
        title,
        body: messageBody,
        data: { type, trip_id: trip_id ?? null },
      }));

      const pushRes = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });

      if (!pushRes.ok) {
        console.error("Expo push send failed:", pushRes.status, await pushRes.text());
      } else {
        const pushResult = await pushRes.json();
        // Expo returns per-message tickets; a DeviceNotRegistered error means
        // the token is stale (app uninstalled, etc.) — clean it up so future
        // sends don't keep failing against it.
        const tickets = pushResult?.data ?? [];
        const staleTokens: string[] = [];
        tickets.forEach((ticket: { status: string; details?: { error?: string } }, i: number) => {
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            staleTokens.push(tokens[i].token);
          }
        });
        if (staleTokens.length > 0) {
          await supabase.from("client_push_tokens").delete().in("token", staleTokens);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, devicesNotified: tokens?.length ?? 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-push-notification error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
