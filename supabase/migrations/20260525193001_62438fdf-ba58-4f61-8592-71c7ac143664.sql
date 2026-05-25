
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS funnel_id text,
  ADD COLUMN IF NOT EXISTS funnel_name text,
  ADD COLUMN IF NOT EXISTS funnel_slug text,
  ADD COLUMN IF NOT EXISTS raw_answers jsonb;
CREATE INDEX IF NOT EXISTS idx_quote_requests_funnel_slug ON public.quote_requests(funnel_slug) WHERE funnel_slug IS NOT NULL;
