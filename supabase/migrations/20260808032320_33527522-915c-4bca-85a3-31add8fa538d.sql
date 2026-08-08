ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS storefront_slug text,
  ADD COLUMN IF NOT EXISTS storefront_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS storefront_headline text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_storefront_slug_key
  ON public.profiles (lower(storefront_slug))
  WHERE storefront_slug IS NOT NULL;

DROP POLICY IF EXISTS "Public can view enabled storefronts" ON public.profiles;
CREATE POLICY "Public can view enabled storefronts"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (storefront_enabled = true);

GRANT SELECT ON public.profiles TO anon;