DROP POLICY IF EXISTS "Public can view enabled storefronts" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;

CREATE OR REPLACE VIEW public.public_storefronts
WITH (security_invoker = off) AS
SELECT storefront_slug, storefront_headline, full_name, avatar_url, job_title, agency_name
FROM public.profiles
WHERE storefront_enabled = true AND storefront_slug IS NOT NULL;

GRANT SELECT ON public.public_storefronts TO anon, authenticated;