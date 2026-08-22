ALTER TABLE public.trip_payments
  ADD COLUMN IF NOT EXISTS payer_traveler_id uuid REFERENCES public.trip_travelers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS payer_email text;

CREATE INDEX IF NOT EXISTS idx_trip_payments_payer_traveler ON public.trip_payments(payer_traveler_id);

CREATE TABLE IF NOT EXISTS public.booking_payer_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  traveler_id uuid REFERENCES public.trip_travelers(id) ON DELETE SET NULL,
  payer_name text NOT NULL,
  payer_email text,
  share_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_payer_shares_booking ON public.booking_payer_shares(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_payer_shares_trip ON public.booking_payer_shares(trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_payer_shares TO authenticated;
GRANT ALL ON public.booking_payer_shares TO service_role;

ALTER TABLE public.booking_payer_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors manage their own booking payer shares"
ON public.booking_payer_shares FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and bookkeepers manage all booking payer shares"
ON public.booking_payer_shares FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin') OR public.is_bookkeeper(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin') OR public.is_bookkeeper(auth.uid()));

CREATE TRIGGER update_booking_payer_shares_updated_at
BEFORE UPDATE ON public.booking_payer_shares
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_split_payments boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_split_payers integer NOT NULL DEFAULT 2;