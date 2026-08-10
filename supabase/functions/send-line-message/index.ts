// send-line-message — called from the agent-dash UI when an agent replies
// to a LINE conversation. Uses LINE's push message API (not the reply API,
// which requires a short-lived reply token only available inside a
// webhook event — a push message works any time, which fits an agent
// replying whenever they get to it, not instantly).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const accessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "LINE_CHANNEL_ACCESS_TOKEN not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Requires the calling agent's own JWT — resolves their user id from
    // that, same pattern as everywhere else in this codebase, rather than
    // trusting a client-supplied agent id.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const agentId = userData.user.id;

    const { conversationId, text } = await req.json();
    if (!conversationId || !text) {
      return new Response(JSON.stringify({ error: "conversationId and text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: convo, error: convoError } = await supabase
      .from("line_conversations")
      .select("id, line_user_id")
      .eq("id", conversationId)
      .single();
    if (convoError || !convo) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: convo.line_user_id,
        messages: [{ type: "text", text }],
      }),
    });

    if (!lineRes.ok) {
      const errBody = await lineRes.text();
      console.error("[send-line-message] LINE push API failed:", lineRes.status, errBody);
      return new Response(JSON.stringify({ error: "Failed to send via LINE" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record it in our own history + reset unread count, then also
    // auto-assign the conversation to this agent if it wasn't already
    // claimed by someone — replying is a natural "I've got this" signal.
    await supabase.from("line_messages").insert({
      conversation_id: convo.id,
      direction: "outbound",
      message_type: "text",
      text,
      sent_by_agent_id: agentId,
    });

    await supabase
      .from("line_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.slice(0, 120),
        unread_count: 0,
      })
      .eq("id", convo.id);

    await supabase
      .from("line_conversations")
      .update({ assigned_agent_id: agentId })
      .eq("id", convo.id)
      .is("assigned_agent_id", null);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-line-message] error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
