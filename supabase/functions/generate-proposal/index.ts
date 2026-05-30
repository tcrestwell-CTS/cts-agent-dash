import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, force } = await req.json();
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
    if (!force && (lead.proposal_status === 'draft' || lead.proposal_status === 'sent')) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Proposal already exists' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as generating
    await supabase.from('quote_requests').update({ proposal_status: 'generating' }).eq('id', lead_id);

    // Build the prompt for Terrance  
    const prompt = `
You are Terrance, a proposal writer AI agent for Crestwell Travel Services — a full-service travel agency in the Southeast US.

CORE TRIP TYPES WE OFFER:
1. Cruise Vacation (Carnival, Royal Caribbean, Norwegian, Celebrity, Disney, MSC, etc.)
2. All-Inclusive Resort (Sandals, Beaches, Hyatt Ziva, Excellence, Secrets, etc.)
3. Vacations by Rail (Amtrak packages, scenic rail journeys)
4. Destination Package (custom multi-component trips)
5. Domestic Travel (US-based — vacation rentals, hotels, tours, city getaways)
6. Hotel Stay (standalone hotel bookings)
7. Vacation Home (rental homes, condos, beach houses, mountain cabins)
8. Family Vacation (family-friendly resorts, activities, multi-generational)
9. Disney / Theme Park (Disney World, Disneyland, Universal, theme park packages)
10. Group Trip (group cruises, destination weddings, reunions, corporate retreats)
11. Luxury Travel (premium experiences, first-class, boutique properties)
12. Honeymoon (romantic getaways, overwater bungalows, couples resorts)
13. Other (custom/unique travel requests)

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
0. **MOST IMPORTANT — STAY ON SCOPE.** Only propose what the client actually requested. If they asked for a specific hotel stay in a specific city, quote ONE option that matches exactly. Do NOT add extra destinations, cruises, tours, upgrades, or alternative properties they didn't ask about. Only widen to 2-3 options when the request is genuinely vague (e.g., "somewhere warm in March").

1. Create a focused proposal with these sections:
   - **Greeting** — Personalized hello using their first name
   - **Trip Overview** — One short paragraph confirming what they asked for
   - **Recommendation** — The specific option(s) that match the request. Default to ONE option when the request is specific (named destination + trip type). Use 2-3 only if the request is ambiguous.
   - **What's Included** — Key inclusions for the recommended option
   - **Travel Dates** — Confirm dates from their input
   - **Next Steps** — Clear call to action (confirm, ask questions, book a call)
   - **Closing** — Warm sign-off from Tim Crestwell

2. Match the trip type they selected — do not pivot them to a different product (no cruises for a hotel-stay request, no resorts for a rail request, etc.).
3. If budget is provided, stay within it. If not, give a single sensible price range — do not fan out across price tiers unless asked.
4. Be specific (named property, cruise line + ship, resort brand, Amtrak route, park + ticket type) but only for the requested trip type.
5. Keep the tone conversational but professional — not salesy. Short and focused beats long and padded.
6. NEVER mention AI, automation, or that this was auto-generated.

Format the proposal in clean markdown.
`.trim();

    // Call Lovable AI Gateway
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: 'You are Terrance, a travel proposal specialist. Write compelling, personalized travel proposals. Output clean markdown only — no preamble or explanation.' },
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
