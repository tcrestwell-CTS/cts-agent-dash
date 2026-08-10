// line-webhook — receives inbound events from LINE's Messaging API
// (messages, follow events) and stores them in line_conversations /
// line_messages. Every LINE Official Account event hits this single
// webhook URL, registered in the LINE Developers Console.
//
// Requires LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN as Supabase
// secrets on this project — the function fails closed (returns 200 but
// does nothing) if they're not configured, rather than erroring loudly
// on every LINE retry attempt.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET");
  const accessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!channelSecret || !accessToken) {
    console.warn("[line-webhook] LINE_CHANNEL_SECRET/LINE_CHANNEL_ACCESS_TOKEN not configured — ignoring event");
    return new Response("OK", { status: 200 });
  }

  const bodyText = await req.text();

  // Verify this genuinely came from LINE — HMAC-SHA256 of the raw body
  // using the channel secret, base64-encoded, compared to the
  // x-line-signature header. Never process an unverified webhook.
  const signature = req.headers.get("x-line-signature") ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bodyText));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
  if (signature !== expectedSignature) {
    console.error("[line-webhook] Signature verification failed — rejecting");
    return new Response("Invalid signature", { status: 401 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = JSON.parse(bodyText);
  const events = body.events ?? [];

  for (const event of events) {
    const lineUserId: string | undefined = event.source?.userId;
    if (!lineUserId) continue;

    // Find or create the conversation for this LINE user.
    let { data: convo } = await supabase
      .from("line_conversations")
      .select("id")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (!convo) {
      // Fetch the user's LINE profile (display name, picture) — best
      // effort, a failure here shouldn't block creating the conversation.
      let displayName: string | null = null;
      let pictureUrl: string | null = null;
      try {
        const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          displayName = profile.displayName ?? null;
          pictureUrl = profile.pictureUrl ?? null;
        }
      } catch (err) {
        console.warn("[line-webhook] Could not fetch LINE profile:", err);
      }

      const { data: newConvo, error: insertError } = await supabase
        .from("line_conversations")
        .insert({ line_user_id: lineUserId, display_name: displayName, picture_url: pictureUrl })
        .select("id")
        .single();
      if (insertError) {
        console.error("[line-webhook] Failed to create conversation:", insertError);
        continue;
      }
      convo = newConvo;
    }

    if (event.type === "message" && event.message?.type === "text") {
      const text: string = event.message.text;

      const { error: msgError } = await supabase.from("line_messages").insert({
        conversation_id: convo.id,
        direction: "inbound",
        message_type: "text",
        text,
        raw_line_message_id: event.message.id ?? null,
      });
      if (msgError) console.error("[line-webhook] Failed to insert message:", msgError);

      // Read-then-write for unread_count since Supabase JS doesn't do
      // atomic increments in a plain .update() call.
      const { data: current } = await supabase
        .from("line_conversations")
        .select("unread_count")
        .eq("id", convo.id)
        .single();

      await supabase
        .from("line_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: text.slice(0, 120),
          unread_count: (current?.unread_count ?? 0) + 1,
        })
        .eq("id", convo.id);
    }
    // Other event types (follow, image messages, stickers, etc.) can be
    // added here later — text messages cover the core use case for now.
  }

  return new Response("OK", { status: 200 });
});
