DROP VIEW IF EXISTS public.public_storefronts;
CREATE VIEW public.public_storefronts AS
SELECT storefront_slug,
       storefront_headline,
       full_name,
       avatar_url,
       job_title,
       agency_name,
       user_id
FROM public.profiles
WHERE storefront_enabled = true AND storefront_slug IS NOT NULL;

GRANT SELECT ON public.public_storefronts TO anon, authenticated;