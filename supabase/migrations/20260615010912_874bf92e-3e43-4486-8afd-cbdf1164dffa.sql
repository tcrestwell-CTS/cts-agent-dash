
DROP POLICY IF EXISTS "email-assets authenticated upload" ON storage.objects;
CREATE POLICY "email-assets authenticated upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'email-assets'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload trip covers" ON storage.objects;
CREATE POLICY "Users can upload trip covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trip-covers'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'office_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE (t.id)::text = (storage.foldername(name))[1]
        AND t.user_id = auth.uid()
    )
  )
);
