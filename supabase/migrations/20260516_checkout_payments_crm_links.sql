-- Migration: Add CRM link columns to checkout_payments
-- Run in CTS Supabase (zbtnulzvwreqzbmxulpv) SQL Editor

ALTER TABLE checkout_payments
  ADD COLUMN IF NOT EXISTS trip_payment_id  UUID REFERENCES trip_payments(id),
  ADD COLUMN IF NOT EXISTS trip_id          UUID REFERENCES trips(id),
  ADD COLUMN IF NOT EXISTS agent_user_id    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS booking_id       UUID REFERENCES bookings(id);

-- Update payment_type check to include new values
ALTER TABLE checkout_payments
  DROP CONSTRAINT IF EXISTS checkout_payments_payment_type_check;

ALTER TABLE checkout_payments
  ADD CONSTRAINT checkout_payments_payment_type_check
  CHECK (payment_type IN (
    'custom', 'deposit', 'balance', 'package',
    'trip_installment',    -- CRM-linked installment payment
    'unattributed_deposit' -- public deposit with no CRM match → clearing queue
  ));

CREATE INDEX IF NOT EXISTS idx_checkout_payments_trip_payment_id
  ON checkout_payments(trip_payment_id) WHERE trip_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checkout_payments_trip_id
  ON checkout_payments(trip_id) WHERE trip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checkout_payments_unattributed
  ON checkout_payments(payment_type, created_at)
  WHERE payment_type = 'unattributed_deposit';
