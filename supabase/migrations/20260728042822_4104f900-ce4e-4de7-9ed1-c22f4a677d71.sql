-- Client documents: require trip ownership (path = <trip_id>/<user_id>/...)
DROP POLICY IF EXISTS client_documents_read_own ON storage.objects;
DROP POLICY IF EXISTS client_documents_insert_own ON storage.objects;

CREATE POLICY client_documents_read_own
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (auth.uid())::text = (storage.foldername(name))[2]
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'office_admin')
      OR EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.user_id = auth.uid()
      )
    )
  );

CREATE POLICY client_documents_insert_own
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (auth.uid())::text = (storage.foldername(name))[2]
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'office_admin')
      OR EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.user_id = auth.uid()
      )
    )
  );

-- Itinerary covers: restrict INSERT to the uploader's own folder
DROP POLICY IF EXISTS "Authenticated users can upload itinerary covers" ON storage.objects;

CREATE POLICY "Authenticated users can upload itinerary covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'itinerary-covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );