
-- 1. qbo_account_mappings
CREATE TABLE IF NOT EXISTS public.qbo_account_mappings (
  role text PRIMARY KEY,
  qbo_account_id text NOT NULL,
  qbo_account_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.qbo_account_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read qbo_account_mappings"
  ON public.qbo_account_mappings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Recon admins can write qbo_account_mappings"
  ON public.qbo_account_mappings FOR ALL
  TO authenticated
  USING (public.is_recon_admin())
  WITH CHECK (public.is_recon_admin());

CREATE TRIGGER trg_qbo_account_mappings_updated_at
  BEFORE UPDATE ON public.qbo_account_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allowed roles documented as a comment (not enforced as enum to allow future expansion)
COMMENT ON COLUMN public.qbo_account_mappings.role IS
  'One of: trip_clearing, loan_principal_clearing, loan_interest_clearing, loan_receivable, interest_income, operating_bank';

-- 2. loan_payment_schedules tracking columns
ALTER TABLE public.loan_payment_schedules
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS qbo_principal_deposit_id text,
  ADD COLUMN IF NOT EXISTS qbo_interest_deposit_id text;

CREATE INDEX IF NOT EXISTS idx_loan_payment_schedules_stripe_pi
  ON public.loan_payment_schedules(stripe_payment_intent_id);

-- 3. qbo_sync_logs idempotency / pairing
ALTER TABLE public.qbo_sync_logs
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS linked_log_id uuid REFERENCES public.qbo_sync_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qbo_sync_logs_idempotency
  ON public.qbo_sync_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
