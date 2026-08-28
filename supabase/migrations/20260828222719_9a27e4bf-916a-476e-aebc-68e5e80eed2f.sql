ALTER TABLE public.loan_payment_schedules
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS stripe_fee numeric,
  ADD COLUMN IF NOT EXISTS stripe_receipt_url text;

CREATE UNIQUE INDEX IF NOT EXISTS loan_payment_schedules_stripe_charge_id_key
  ON public.loan_payment_schedules (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;