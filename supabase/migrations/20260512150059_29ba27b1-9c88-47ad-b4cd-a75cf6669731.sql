ALTER TABLE public.stripe_payouts
  ADD COLUMN IF NOT EXISTS qbo_trip_transfer_id text,
  ADD COLUMN IF NOT EXISTS qbo_loan_principal_transfer_id text,
  ADD COLUMN IF NOT EXISTS qbo_loan_interest_transfer_id text,
  ADD COLUMN IF NOT EXISTS qbo_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS breakdown jsonb;