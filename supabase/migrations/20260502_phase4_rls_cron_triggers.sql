-- ============================================================
-- PHASE 4 — CHUNK 1: RLS POLICIES
-- Run in Supabase SQL Editor
-- Pattern matches existing project: user_roles table, admin/office_admin/user
-- ============================================================

-- Helper function: check if current user is admin or office_admin
CREATE OR REPLACE FUNCTION public.is_recon_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'office_admin')
  );
$$;

-- Helper function: check if any authenticated user (all staff can read recon data)
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

-- ─── QBO CACHE TABLES (read: all staff, write: service role only) ───

ALTER TABLE public.qbo_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_vendors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_deposits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_bills           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_bill_payments   ENABLE ROW LEVEL SECURITY;

-- All authenticated staff can read QBO cache
CREATE POLICY "Staff can read QBO accounts"
  ON public.qbo_accounts FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read QBO customers"
  ON public.qbo_customers FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read QBO vendors"
  ON public.qbo_vendors FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read QBO invoices"
  ON public.qbo_invoices FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read QBO payments"
  ON public.qbo_payments FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read QBO deposits"
  ON public.qbo_deposits FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read QBO bills"
  ON public.qbo_bills FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read QBO bill payments"
  ON public.qbo_bill_payments FOR SELECT
  USING (is_authenticated());

-- Only admins can manually insert/update QBO cache (edge functions use service role)
CREATE POLICY "Admins can write QBO accounts"
  ON public.qbo_accounts FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

CREATE POLICY "Admins can write QBO customers"
  ON public.qbo_customers FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

CREATE POLICY "Admins can write QBO vendors"
  ON public.qbo_vendors FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

CREATE POLICY "Admins can write QBO invoices"
  ON public.qbo_invoices FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

CREATE POLICY "Admins can write QBO payments"
  ON public.qbo_payments FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

CREATE POLICY "Admins can write QBO deposits"
  ON public.qbo_deposits FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

CREATE POLICY "Admins can write QBO bills"
  ON public.qbo_bills FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

CREATE POLICY "Admins can write QBO bill payments"
  ON public.qbo_bill_payments FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

-- ─── STRIPE TABLES (read: all staff, write: service role only) ───

ALTER TABLE public.stripe_webhook_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_refunds         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_disputes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payouts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payout_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read stripe webhook events"
  ON public.stripe_webhook_events FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read stripe payments"
  ON public.stripe_payments FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read stripe refunds"
  ON public.stripe_refunds FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read stripe disputes"
  ON public.stripe_disputes FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read stripe payouts"
  ON public.stripe_payouts FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can read stripe payout payments"
  ON public.stripe_payout_payments FOR SELECT
  USING (is_authenticated());

-- ─── RECONCILIATION TABLES ───────────────────────────────────

ALTER TABLE public.recon_matches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exception_queue       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recon_entity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recon_account_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recon_audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recon_dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- Matches: all staff read, admins write
CREATE POLICY "Staff can read recon matches"
  ON public.recon_matches FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Admins can write recon matches"
  ON public.recon_matches FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

-- Exceptions: all staff read, all staff can update (assign/resolve), admins delete
CREATE POLICY "Staff can read exceptions"
  ON public.exception_queue FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Staff can update exceptions"
  ON public.exception_queue FOR UPDATE
  USING (is_authenticated())
  WITH CHECK (is_authenticated());

CREATE POLICY "Admins can insert exceptions"
  ON public.exception_queue FOR INSERT
  WITH CHECK (is_recon_admin());

CREATE POLICY "Admins can delete exceptions"
  ON public.exception_queue FOR DELETE
  USING (is_recon_admin());

-- Approval tasks: all staff read, admins approve/reject
CREATE POLICY "Staff can read approval tasks"
  ON public.approval_tasks FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Admins can write approval tasks"
  ON public.approval_tasks FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

-- Staff can update approval tasks (for approve/reject actions)
CREATE POLICY "Staff can update approval tasks"
  ON public.approval_tasks FOR UPDATE
  USING (is_authenticated())
  WITH CHECK (is_authenticated());

-- Entity mappings: all staff read, admins write
CREATE POLICY "Staff can read entity mappings"
  ON public.recon_entity_mappings FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Admins can write entity mappings"
  ON public.recon_entity_mappings FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

-- Account config: all staff read, only admins write
CREATE POLICY "Staff can read account config"
  ON public.recon_account_config FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Admins can write account config"
  ON public.recon_account_config FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());

-- Audit log: all staff read, immutable (no update/delete even for admins)
CREATE POLICY "Staff can read audit log"
  ON public.recon_audit_log FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Service role can insert audit log"
  ON public.recon_audit_log FOR INSERT
  WITH CHECK (is_authenticated());

-- Dead letter queue: admins only
CREATE POLICY "Admins can read dead letter queue"
  ON public.recon_dead_letter_queue FOR SELECT
  USING (is_recon_admin());

CREATE POLICY "Admins can write dead letter queue"
  ON public.recon_dead_letter_queue FOR ALL
  USING (is_recon_admin())
  WITH CHECK (is_recon_admin());


-- ============================================================
-- PHASE 4 — CHUNK 2: SCHEDULED JOBS (pg_cron)
-- Run in Supabase SQL Editor
-- Requires pg_cron extension (enabled by default in Supabase)
-- ============================================================

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily QBO cache sync at 2:00 AM ET (7:00 AM UTC)
SELECT cron.schedule(
  'qbo-cache-sync-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/qbo-cache-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-agent-secret', current_setting('app.agent_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Daily reconciliation run at 3:00 AM ET (8:00 AM UTC) — after cache sync completes
SELECT cron.schedule(
  'recon-engine-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/recon-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-agent-secret', current_setting('app.agent_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Dead letter retry every 30 minutes
SELECT cron.schedule(
  'dead-letter-retry',
  '*/30 * * * *',
  $$
  -- Reset items that have retries remaining back to retrying status
  UPDATE public.recon_dead_letter_queue
  SET status = 'retrying',
      retry_count = retry_count + 1,
      last_retry_at = now()
  WHERE status = 'failed'
    AND retry_count < max_retries
    AND (last_retry_at IS NULL OR last_retry_at < now() - interval '30 minutes');
  $$
);

-- Set required app settings for cron jobs
-- Run these too:
-- ALTER DATABASE postgres SET app.supabase_url = 'https://zbtnulzvwreqzbmxulpv.supabase.co';
-- ALTER DATABASE postgres SET app.agent_secret = 'YOUR_AGENT_SECRET_HERE';


-- ============================================================
-- PHASE 4 — CHUNK 3: UPDATED_AT TRIGGERS
-- Auto-update updated_at on recon tables
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_recon_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER recon_matches_updated_at
  BEFORE UPDATE ON public.recon_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_recon_updated_at();

CREATE TRIGGER exception_queue_updated_at
  BEFORE UPDATE ON public.exception_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_recon_updated_at();

CREATE TRIGGER approval_tasks_updated_at
  BEFORE UPDATE ON public.approval_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_recon_updated_at();

CREATE TRIGGER recon_entity_mappings_updated_at
  BEFORE UPDATE ON public.recon_entity_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_recon_updated_at();
