ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS group_payment_flow text NOT NULL DEFAULT 'stripe_deposit';
ALTER TABLE public.group_bookings ADD COLUMN IF NOT EXISTS payment_preference text;
ALTER TABLE public.group_bookings ADD COLUMN IF NOT EXISTS cc_authorization_id uuid;
COMMENT ON COLUMN public.trips.group_payment_flow IS 'stripe_deposit = card charge in wizard; cc_auth = reservation + CC authorization form + payment schedule';