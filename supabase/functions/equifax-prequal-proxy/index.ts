// Proxies Equifax pre-qual requests to the public site API.
// The public site endpoint does not send CORS headers, so the browser cannot
// call it directly ("Failed to fetch"). This function calls it server-side.
//
// The public site runs against a different database, so looking the application
// up by `application_id` there returns "Application not found". We therefore
// load the application from THIS database and send the applicant data inline,
// then persist the returned decision back onto the row.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TARGET = 'https://crestwellgetaways.com/api/equifax-prequal';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const applicationId = body?.application_id;
    if (!applicationId) return json({ error: 'application_id is required' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: app, error: appError } = await supabase
      .from('loan_applications')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError) return json({ error: appError.message }, 500);
    if (!app) return json({ error: 'Application not found' }, 404);

    const applicant = {
      first_name: app.first_name,
      last_name: app.last_name,
      email: app.email,
      phone: app.phone,
      date_of_birth: app.date_of_birth,
      ssn_last_four: app.ssn_last_four,
      address_line1: app.address_line1,
      address_line2: app.address_line2,
      city: app.city,
      state: app.state,
      zip_code: app.zip_code,
      employer_name: app.employer_name,
      employment_status: app.employment_status,
      monthly_income: app.monthly_income,
      other_income: app.other_income,
      monthly_rent_mortgage: app.monthly_rent_mortgage,
      monthly_car_payment: app.monthly_car_payment,
      monthly_other_debt: app.monthly_other_debt,
      loan_amount_requested: app.loan_amount_requested,
      preferred_term_months: app.preferred_term_months,
      down_payment: app.down_payment,
      bankruptcy_history: app.bankruptcy_history,
      consent_credit_check: app.consent_credit_check,
    };

    const upstream = await fetch(TARGET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: applicationId, applicant }),
    });

    const text = await upstream.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text?.slice(0, 500) || 'Upstream returned a non-JSON response' };
    }

    // Persist the result on this project's row (the public site can't reach it).
    const update: Record<string, unknown> = { equifax_checked_at: new Date().toISOString() };
    if (upstream.ok) {
      update.equifax_score = payload.equifax_score ?? payload.score ?? null;
      update.equifax_decision = payload.decision ?? null;
      update.equifax_reasons = payload.reasons ?? null;
      update.equifax_client_message = payload.client_message ?? null;
      update.equifax_error = payload.error ? String(payload.error) : null;
    } else {
      update.equifax_error = String(payload.error ?? `Upstream ${upstream.status}`);
    }
    await supabase.from('loan_applications').update(update).eq('id', applicationId);

    return json(payload, upstream.ok ? 200 : upstream.status);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy failed';
    console.error('equifax-prequal-proxy error:', message);
    return json({ error: message }, 500);
  }
});
