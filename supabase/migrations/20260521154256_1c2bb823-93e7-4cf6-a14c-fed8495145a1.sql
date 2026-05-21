CREATE TABLE IF NOT EXISTS public.client_document_uploads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  trip_id        UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  client_id      UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  doc_key        TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  file_size      INTEGER,
  mime_type      TEXT,
  reviewed       BOOLEAN DEFAULT FALSE,
  reviewed_by    UUID REFERENCES auth.users(id),
  reviewed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_doc_uploads_trip    ON public.client_document_uploads(trip_id);
CREATE INDEX IF NOT EXISTS idx_doc_uploads_client  ON public.client_document_uploads(client_id);
CREATE INDEX IF NOT EXISTS idx_doc_uploads_unreviewed
  ON public.client_document_uploads(reviewed, created_at)
  WHERE reviewed = FALSE;

ALTER TABLE public.client_document_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_read_uploads" ON public.client_document_uploads;
CREATE POLICY "agent_read_uploads" ON public.client_document_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = client_document_uploads.trip_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_update_reviewed" ON public.client_document_uploads;
CREATE POLICY "agent_update_reviewed" ON public.client_document_uploads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = client_document_uploads.trip_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_role_all" ON public.client_document_uploads;
CREATE POLICY "service_role_all" ON public.client_document_uploads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.client_portal_sessions
  ADD COLUMN IF NOT EXISTS unread_message_count INTEGER DEFAULT 0;

-- Storage RLS for the private client-documents bucket
-- Path convention: <trip_id>/<auth_uid>/<filename>
DROP POLICY IF EXISTS "client_documents_read_own" ON storage.objects;
CREATE POLICY "client_documents_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

DROP POLICY IF EXISTS "client_documents_insert_own" ON storage.objects;
CREATE POLICY "client_documents_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );