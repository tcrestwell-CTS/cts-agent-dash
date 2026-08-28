ALTER TABLE public.trip_payments
  ADD COLUMN IF NOT EXISTS supplier_paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS supplier_payment_method text,
  ADD COLUMN IF NOT EXISTS supplier_payment_ref text;