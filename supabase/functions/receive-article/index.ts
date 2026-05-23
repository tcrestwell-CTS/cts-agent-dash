import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE_DOMAIN   = 'https://crestwellgetaways.com';
const WEBHOOK_TOKEN = 'aseo_wh_9cc6393ec616aada27c28e411855cb90';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function calcReadingTime(html: string): number {
  const text = stripHtml(html);
  const wordCount = text.split(' ').filter(Boolean).length;
  return Math.ceil(wordCount / 200);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify webhook token
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token !== WEBHOOK_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Test ping
  if (body.event === 'test') {
    return new Response(JSON.stringify({ url: `${SITE_DOMAIN}/blog/test`, status: 'ok' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Use service role key so RLS doesn't block the insert/upsert
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const reading_time = body.content_html
      ? calcReadingTime(body.content_html)
      : (body.reading_time ?? 5);

    // blog_posts uses its own auto-generated integer PK — never pass body.id
    const record: Record<string, any> = {
      title:            body.title,
      slug:             body.slug,
      content_html:     body.content_html     ?? null,
      content_markdown: body.content_markdown ?? null,
      hero_image_url:   body.heroImageUrl     ?? body.hero_image_url ?? null,
      hero_image_alt:   body.heroImageAlt     ?? body.hero_image_alt ?? null,
      infographic_url:  body.infographicImageUrl ?? null,
      meta_description: body.metaDescription  ?? body.meta_description ?? null,
      meta_keywords:    body.metaKeywords     ?? body.meta_keywords ?? null,
      tags:             body.wordpressTags    ?? body.tags ?? null,
      faq_schema:       body.faqSchema        ?? null,
      language:         body.languageCode     ?? body.language ?? 'en',
      reading_time,
      published_at:     body.publishedAt      ?? body.published_at ?? null,
    };

    // Upsert on slug — idempotent so retries never create duplicates
    const { data, error } = await supabase
      .from('blog_posts')
      .upsert(record, { onConflict: 'slug', ignoreDuplicates: false })
      .select('id, slug')
      .single();

    if (error) throw new Error(error.message);

    const articleUrl = `${SITE_DOMAIN}/blog/${data.slug}`;

    console.log(`[receive-article] ✓ Upserted "${body.title}" → ${articleUrl}`);

    return new Response(JSON.stringify({ url: articleUrl, status: 'ok', id: data.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[receive-article] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
