-- Migration: Client document uploads for portal travel doc checklist
-- Run in CTS Supabase (zbtnulzvwreqzbmxulpv) SQL Editor

-- 1. Create client document uploads tracking table
CREATE TABLE IF NOT EXISTS client_document_uploads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  trip_id        UUID REFERENCES trips(id) ON DELETE CASCADE,
  client_id      UUID REFERENCES clients(id) ON DELETE CASCADE,
  doc_key        TEXT NOT NULL,  -- e.g. "passport", "insurance"
  file_name      TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  file_size      INTEGER,
  mime_type      TEXT,
  reviewed       BOOLEAN DEFAULT FALSE,
  reviewed_by    UUID REFERENCES auth.users(id),
  reviewed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_doc_uploads_trip    ON client_document_uploads(trip_id);
CREATE INDEX IF NOT EXISTS idx_doc_uploads_client  ON client_document_uploads(client_id);
CREATE INDEX IF NOT EXISTS idx_doc_uploads_unreviewed
  ON client_document_uploads(reviewed, created_at)
  WHERE reviewed = FALSE;

ALTER TABLE client_document_uploads ENABLE ROW LEVEL SECURITY;

-- Agents can read uploads for their clients
CREATE POLICY "agent_read_uploads" ON client_document_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips t
      JOIN clients c ON c.id = t.client_id
      WHERE t.id = client_document_uploads.trip_id
        AND t.user_id = auth.uid()
    )
  );

-- Agents can update reviewed status
CREATE POLICY "agent_update_reviewed" ON client_document_uploads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = client_document_uploads.trip_id
        AND t.user_id = auth.uid()
    )
  );

-- Service role full access (for portal-data edge function)
CREATE POLICY "service_role_all" ON client_document_uploads
  FOR ALL TO service_role USING (true);

-- 2. Create Supabase Storage bucket (run separately in Storage UI or via API)
-- Bucket name: client-documents
-- Private bucket (no public access)
-- Max file size: 10MB
-- Allowed MIME types: application/pdf, image/jpeg, image/png, image/webp

-- 3. Storage RLS — clients can upload to their own folder
-- This is set in the Supabase Storage bucket policies UI:
-- Allow INSERT where (bucket_id = 'client-documents' AND auth.uid()::text = (storage.foldername(name))[2])
-- Allow SELECT where (bucket_id = 'client-documents' AND auth.uid()::text = (storage.foldername(name))[2])

-- 4. Add unread_count tracking to client_portal_sessions
ALTER TABLE client_portal_sessions
  ADD COLUMN IF NOT EXISTS unread_message_count INTEGER DEFAULT 0;
