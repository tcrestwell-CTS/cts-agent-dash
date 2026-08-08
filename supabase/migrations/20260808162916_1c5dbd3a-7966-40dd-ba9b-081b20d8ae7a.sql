GRANT SELECT ON public.profiles TO anon;
CREATE POLICY anon_view_enabled_storefronts
  ON public.profiles
  FOR SELECT
  TO anon
  USING (storefront_enabled = true);