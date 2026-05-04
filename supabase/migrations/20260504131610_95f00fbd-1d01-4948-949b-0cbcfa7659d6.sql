-- Extend email_logs to support failure/retry tracking
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Make client_id and user_id nullable so we can log system emails (invitations, etc.)
ALTER TABLE public.email_logs ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN user_id DROP NOT NULL;

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON public.email_logs (template);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_idempotency_key ON public.email_logs (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Allow admins and office admins to view all email logs
DROP POLICY IF EXISTS "Admins can view all email logs" ON public.email_logs;
CREATE POLICY "Admins can view all email logs"
  ON public.email_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );