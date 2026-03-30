import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'lead_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch the lead
    const { data: lead, error } = await supabase
      .from('quote_requests')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (error || !lead) {
      console.error('Lead not found:', error);
      return new Response(JSON.stringify({ error: 'Lead not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Skip if proposal already generated
    if (lead.proposal_status === 'draft' || lead.proposal_status === 'sent') {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Proposal already exists' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as generating
    await supabase.from('quote_requests').update({ proposal_status: 'generating' }).eq('id', lead_id);

    // Build the prompt for Terrance
    const prompt = `
You are Terrance, a proposal writer AI agent for Crestwell Travel Services — a travel agency in the Southeast US specializing in cruises, all-inclusive resorts, and group vacations.

Generate a personalized travel proposal draft for this lead. The proposal should be warm, professional, and exciting. Write it as if Tim Crestwell (the agency owner) is presenting the trip to the client.

LEAD DETAILS:
- Name: ${lead.first_name} ${lead.last_name}
- Email: ${lead.email}
- Phone: ${lead.phone || 'not provided'}
- Trip Type: ${lead.trip_type || 'not specified'}
- Destination: ${lead.destination || 'not specified'}
- Departure Date: ${lead.departure_date || 'flexible'}
- Date Flexibility: ${lead.flexibility || 'not specified'}
- Adults: ${lead.travelers_adults || 2}
- Children: ${lead.travelers_children || 0}
- Budget: ${lead.budget || 'not specified'}
- Message from Client: ${lead.message || 'none'}
- AI Qualification Summary: ${lead.ai_summary || 'none'}
- AI Score: ${lead.ai_score || 'N/A'}/100
- AI Tags: ${lead.ai_tags ? (Array.isArray(lead.ai_tags) ? lead.ai_tags.join(', ') : lead.ai_tags) : 'none'}

INSTRUCTIONS:
1. Create a compelling proposal with these sections:
   - **Greeting** — Personalized hello using their first name
   - **Trip Overview** — Brief exciting summary of what you're recommending
   - **Recommended Options** — 2-3 specific options based on their preferences (cruise lines, resorts, or packages). Include estimated pricing ranges if budget was provided.
   - **What's Included** — Key inclusions for each option
   - **Travel Dates** — Confirm or suggest dates based on their input
   - **Next Steps** — Clear call to action (book a call, confirm option, ask questions)
   - **Closing** — Warm sign-off from Tim Crestwell

2. If the destination is vague, suggest 2-3 specific destinations that match their interests.
3. If budget is not specified, provide options at different price points.
4. For cruises, mention specific cruise lines (Carnival, Royal Caribbean, Norwegian, Celebrity, Disney, etc.)
5. For all-inclusive, mention specific resorts/brands (Sandals, Beaches, Hyatt Ziva, etc.)
6. Keep the tone conversational but professional — not overly salesy.
7. NEVER mention AI, automation, or that this was auto-generated.

Format the proposal in clean markdown.
`.trim();

    // Call Lovable AI Gateway
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are Terrance, a travel proposal specialist. Write compelling, personalized travel proposals. Output clean markdown only — no preamble or explanation.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('AI Gateway error:', aiRes.status, errText);

      // Reset proposal status on failure
      await supabase.from('quote_requests').update({ proposal_status: null }).eq('id', lead_id);

      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited — try again shortly' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Proposal generation failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiRes.json();
    const proposalDraft = aiData.choices?.[0]?.message?.content || '';

    if (!proposalDraft) {
      await supabase.from('quote_requests').update({ proposal_status: null }).eq('id', lead_id);
      return new Response(JSON.stringify({ error: 'Empty proposal generated' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save the proposal draft
    await supabase.from('quote_requests').update({
      proposal_draft: proposalDraft,
      proposal_status: 'draft',
    }).eq('id', lead_id);

    console.log(`Terrance generated proposal for ${lead.first_name} ${lead.last_name} (${lead_id})`);

    return new Response(JSON.stringify({
      success: true,
      lead_id,
      proposal_status: 'draft',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-proposal error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
