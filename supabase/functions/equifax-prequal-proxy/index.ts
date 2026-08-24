// Proxies Equifax pre-qual requests to the public site API.
// The public site endpoint does not send CORS headers, so the browser cannot
// call it directly ("Failed to fetch"). This function calls it server-side.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TARGET = 'https://crestwellgetaways.com/api/equifax-prequal';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    if (!body?.application_id) {
      return new Response(JSON.stringify({ error: 'application_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upstream = await fetch(TARGET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text?.slice(0, 500) || 'Upstream returned a non-JSON response' };
    }

    return new Response(JSON.stringify(payload), {
      status: upstream.ok ? 200 : upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy failed';
    console.error('equifax-prequal-proxy error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
