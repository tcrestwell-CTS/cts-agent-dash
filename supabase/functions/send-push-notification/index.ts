import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");

type Payload = {
  client_id?: string;
  type?: string;
  title?: string;
  body?: string;
  trip_id?: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Service-role only: triggers and internal callers.
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.slice(7) !== SERVICE_ROLE_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const client_id = typeof payload.client_id === "string" ? payload.client_id.trim() : "";
  const type = typeof payload.type === "string" ? payload.type.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const trip_id = typeof payload.trip_id === "string" && payload.trip_id ? payload.trip_id : null;

  const errors: Record<string, string> = {};
  if (!client_id) errors.client_id = "required";
  if (!type) errors.type = "required";
  if (!title) errors.title = "required";
  if (!body) errors.body = "required";
  if (Object.keys(errors).length) return json({ error: errors }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Always persist the in-app notification (independent of push delivery).
  const { error: insertError } = await supabase.from("client_notifications").insert({
    client_id,
    type,
    title,
    body: body.slice(0, 500),
    trip_id,
  });
  if (insertError) {
    console.error("client_notifications insert failed", insertError.message);
    return json({ error: "Failed to record notification" }, 500);
  }

  // 2. Fan out to registered devices.
  const { data: tokens, error: tokenError } = await supabase
    .from("client_push_tokens")
    .select("id, token, platform")
    .eq("client_id", client_id);

  if (tokenError) {
    console.error("token lookup failed", tokenError.message);
    return json({ recorded: true, pushed: 0, note: "token lookup failed" });
  }

  const all = tokens ?? [];
  if (all.length === 0) return json({ recorded: true, pushed: 0 });

  const data = { type, trip_id };
  const expoTokens = all.filter((t) => String(t.token).startsWith("ExponentPushToken"));
  const fcmTokens = all.filter((t) => !String(t.token).startsWith("ExponentPushToken"));
  const invalidTokenIds: string[] = [];
  let pushed = 0;

  // Expo push (batched)
  if (expoTokens.length > 0) {
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          expoTokens.map((t) => ({ to: t.token, title, body, data, sound: "default" })),
        ),
      });
      const out = await res.json().catch(() => null);
      const receipts = Array.isArray(out?.data) ? out.data : [];
      receipts.forEach((r: { status?: string; details?: { error?: string } }, i: number) => {
        if (r?.status === "ok") pushed++;
        else if (r?.details?.error === "DeviceNotRegistered") invalidTokenIds.push(expoTokens[i].id);
      });
    } catch (e) {
      console.error("expo push failed", e instanceof Error ? e.message : String(e));
    }
  }

  // FCM legacy HTTP (only if a server key is configured)
  if (fcmTokens.length > 0 && FCM_SERVER_KEY) {
    for (const t of fcmTokens) {
      try {
        const res = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${FCM_SERVER_KEY}`,
          },
          body: JSON.stringify({ to: t.token, notification: { title, body }, data }),
        });
        const out = await res.json().catch(() => null);
        if (out?.success === 1) pushed++;
        const err = out?.results?.[0]?.error;
        if (err === "NotRegistered" || err === "InvalidRegistration") invalidTokenIds.push(t.id);
      } catch (e) {
        console.error("fcm push failed", e instanceof Error ? e.message : String(e));
      }
    }
  } else if (fcmTokens.length > 0) {
    console.log(`${fcmTokens.length} native token(s) skipped — FCM_SERVER_KEY not configured`);
  }

  // 3. Prune dead devices.
  if (invalidTokenIds.length > 0) {
    await supabase.from("client_push_tokens").delete().in("id", invalidTokenIds);
  }

  return json({ recorded: true, devices: all.length, pushed, pruned: invalidTokenIds.length });
});