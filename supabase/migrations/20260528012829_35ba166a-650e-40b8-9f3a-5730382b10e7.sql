
ALTER TABLE public.client_document_uploads
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS description text;

CREATE INDEX IF NOT EXISTS idx_client_document_uploads_trip_uploaded_by
  ON public.client_document_uploads (trip_id, uploaded_by);

DROP POLICY IF EXISTS agent_insert_uploads ON public.client_document_uploads;
CREATE POLICY agent_insert_uploads
  ON public.client_document_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = client_document_uploads.trip_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agent_delete_uploads ON public.client_document_uploads;
CREATE POLICY agent_delete_uploads
  ON public.client_document_uploads
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = client_document_uploads.trip_id
        AND t.user_id = auth.uid()
    )
  );
