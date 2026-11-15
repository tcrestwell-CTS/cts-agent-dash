DROP POLICY IF EXISTS "anon_insert_circle_members" ON public.circle_members;
CREATE POLICY "anon_insert_circle_members" ON public.circle_members
FOR INSERT TO anon
WITH CHECK (
  tier = 'circle'
  AND coalesce(founding_member, false) = false
  AND status = 'active'
  AND source = 'landing_page'
  AND client_id IS NULL
  AND notes IS NULL
  AND trial_ends_at IS NULL
  AND length(btrim(name)) BETWEEN 1 AND 200
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(email) <= 255
);

DROP POLICY IF EXISTS "anon read hotel cache" ON public.hotelbeds_hotels;
DROP POLICY IF EXISTS "Authenticated can read hotelbeds hotels" ON public.hotelbeds_hotels;
CREATE POLICY "Advisors and staff read hotelbeds hotels" ON public.hotelbeds_hotels
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'user'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
);

DROP POLICY IF EXISTS "Public form uploads insert" ON storage.objects;
CREATE POLICY "Public form uploads insert" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'form-uploads'
  AND EXISTS (
    SELECT 1 FROM public.intake_forms f
    WHERE f.id::text = (storage.foldername(name))[1]
      AND f.is_active = true
  )
);