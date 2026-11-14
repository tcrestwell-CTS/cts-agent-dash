ALTER POLICY "Agents read circle briefings" ON public.circle_briefings
USING (
  public.has_role((SELECT auth.uid()), 'user'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'office_admin'::public.app_role)
);

ALTER POLICY "Team reads form uploads" ON storage.objects
USING (
  bucket_id = 'form-uploads'
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'office_admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.intake_forms AS f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.user_id = (SELECT auth.uid())
    )
  )
);

ALTER POLICY "Team deletes form uploads" ON storage.objects
USING (
  bucket_id = 'form-uploads'
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.intake_forms AS f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.user_id = (SELECT auth.uid())
    )
  )
);