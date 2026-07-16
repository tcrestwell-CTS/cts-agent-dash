import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FROM_EMAIL = 'notify@crestwellgetaways.com';
const FROM_NAME = 'Crestwell Travel Services';
const BUCKET = 'agent-documents';
const GUIDES: { path: string; label: string }[] = [
  { path: 'onboarding/CTN_Agent_Setup_Guide.pdf', label: 'CTN Agent Setup Guide' },
  { path: 'onboarding/CareerOverview_BecomingATravelAdvisor.pdf', label: 'Career Overview: Becoming a Travel Advisor' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, full_name } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Idempotency: skip if already sent
    const { data: existing } = await supabase
      .from('email_logs')
      .select('id')
      .eq('to_email', email)
      .eq('template', 'agent_onboarding_guide')
      .limit(1)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7-day signed URLs for each guide
    const signedGuides: { url: string; label: string }[] = [];
    for (const g of GUIDES) {
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(g.path, 60 * 60 * 24 * 7);
      if (signErr || !signed?.signedUrl) throw new Error(signErr?.message || `sign failed for ${g.path}`);
      signedGuides.push({ url: signed.signedUrl, label: g.label });
    }

    const name = full_name || 'there';
    const html = `<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;padding:40px;">
  <table width="560" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr><td style="background:linear-gradient(135deg,#0d1b2a,#1b3a5c);padding:32px;text-align:center;">
      <img src="https://zbtnulzvwreqzbmxulpv.supabase.co/storage/v1/object/public/email-assets/logo.png?v=1" width="160" alt="Crestwell Travel Services"/>
    </td></tr>
    <tr><td style="padding:36px 32px;color:#1a1a1a;">
      <h2 style="margin:0 0 16px;">Welcome to Crestwell, ${name}!</h2>
      <p style="font-size:15px;line-height:1.6;color:#4c5562;">Your agent account is ready. To help you get up and running, we've included two guides below — your dashboard setup walkthrough and a career overview for becoming a travel advisor.</p>
      <div style="text-align:center;margin:28px 0;">
        ${signedGuides.map(g => `<a href="${g.url}" style="display:inline-block;background:#173b75;color:#fff;padding:14px 28px;border-radius:12px;font-weight:600;text-decoration:none;margin:6px;">${g.label}</a>`).join('<br/>')}
      </div>
      <p style="font-size:13px;color:#6b7280;">This download link is valid for 7 days. Questions? Reply to this email or call 888.508.6893.</p>
    </td></tr>
    <tr><td style="background:#f9fafb;padding:16px;text-align:center;font-size:11px;color:#9ca3af;">&copy; ${new Date().getFullYear()} Crestwell Travel Services</td></tr>
  </table>
</body></html>`;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject: 'Welcome to Crestwell — Your Agent Setup Guide',
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Resend error: ${err.message || JSON.stringify(err)}`);
    }

    await supabase.from('email_logs').insert({
      to_email: email,
      template: 'agent_onboarding_guide',
      subject: 'Welcome to Crestwell — Your Agent Setup Guide',
      status: 'sent',
    });

    return new Response(JSON.stringify({ success: true, guides: signedGuides }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});