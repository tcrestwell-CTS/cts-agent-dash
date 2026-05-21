// supabase/functions/qbo-dlq-retry/index.ts
// Processes failed QBO sync events from recon_dead_letter_queue
// Called by n8n every 15 minutes
// Max 3 retries per item with exponential backoff tracking

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-agent-secret",
};

const MAX_RETRIES = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = req.headers.get("x-agent-secret");
  const expected = Deno.env.get("AGENT_SECRET") ?? Deno.env.get("CW_AGENT_SECRET") ?? Deno.env.get("CTN_APPROVE_SECRET");
  if (!secret || secret !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch pending DLQ items (status=failed, retry_count < MAX_RETRIES)
  const { data: items, error: fetchErr } = await supabase
    .from("recon_dead_letter_queue")
    .select("*")
    .eq("status", "failed")
    .lt("retry_count", MAX_RETRIES)
    .order("created_at", { ascending: true })
    .limit(10);

  if (fetchErr) {
    console.error("[dlq-retry] Failed to fetch DLQ:", fetchErr);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!items || items.length === 0) {
    return new Response(JSON.stringify({ processed: 0, message: "No items in DLQ" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  console.log(`[dlq-retry] Processing ${items.length} DLQ items`);

  const results = { resolved: 0, failed: 0, skipped: 0 };

  for (const item of items) {
    try {
      // Retry by calling qbo-sync-trigger with the original payload
      const retryRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/qbo-sync-trigger`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trigger_type: item.event_type,
            record: item.payload,
          }),
        }
      );

      const retryData = await retryRes.json().catch(() => ({}));
      const success = retryRes.ok && !retryData.error;

      // Update DLQ record
      await supabase
        .from("recon_dead_letter_queue")
        .update({
          status:         success ? "resolved" : "failed",
          retry_count:    (item.retry_count || 0) + 1,
          last_retry_at:  new Date().toISOString(),
          error_message:  success ? null : (retryData.error || `HTTP ${retryRes.status}`),
          // Mark permanently failed after max retries
          ...((!success && (item.retry_count || 0) + 1 >= MAX_RETRIES)
            ? { status: "dead" }
            : {}
          ),
        })
        .eq("id", item.id);

      if (success) {
        results.resolved++;
        console.log(`[dlq-retry] ✓ Resolved ${item.event_type} (id=${item.id})`);
      } else {
        results.failed++;
        console.warn(`[dlq-retry] ✗ Still failing ${item.event_type} (id=${item.id}, attempt=${(item.retry_count || 0) + 1})`);
      }
    } catch (err) {
      results.failed++;
      await supabase
        .from("recon_dead_letter_queue")
        .update({
          status:        "failed",
          retry_count:   (item.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq("id", item.id);
    }
  }

  console.log(`[dlq-retry] Done: ${JSON.stringify(results)}`);

  return new Response(JSON.stringify({ ...results, total: items.length }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
