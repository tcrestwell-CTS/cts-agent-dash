ALTER TABLE public.hotelbeds_hotels ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.hotelbeds_hotels TO anon;
DROP POLICY IF EXISTS "anon read hotel cache" ON public.hotelbeds_hotels;
CREATE POLICY "anon read hotel cache"
  ON public.hotelbeds_hotels FOR SELECT
  TO anon USING (true);