ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS booking_flow_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS taxes_fees_per_person numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS group_deposit_per_person numeric(10,2),
  ADD COLUMN IF NOT EXISTS final_payment_due date,
  ADD COLUMN IF NOT EXISTS group_included_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS group_terms text,
  ADD COLUMN IF NOT EXISTS ship_name_display text,
  ADD COLUMN IF NOT EXISTS depart_port text,
  ADD COLUMN IF NOT EXISTS ports_of_call jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_rooms_per_booking integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS promo_codes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.trip_cabin_options
  ADD COLUMN IF NOT EXISTS category_group text NOT NULL DEFAULT 'Inside',
  ADD COLUMN IF NOT EXISTS sleeps_min integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sleeps_max integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS sqft text,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS third_fourth_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS child_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS single_supplement_pct numeric(5,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS inventory integer,
  ADD COLUMN IF NOT EXISTS sold_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accessible_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS badge text;

CREATE TABLE IF NOT EXISTS public.trip_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  price_basis text NOT NULL DEFAULT 'per_person' CHECK (price_basis IN ('per_person','per_room','per_booking')),
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_addons_trip_idx ON public.trip_addons (trip_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_addons TO authenticated;
GRANT ALL ON public.trip_addons TO service_role;

CREATE TABLE IF NOT EXISTS public.group_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','deposit_paid','payment_failed','cancelled')),
  contact_first_name text NOT NULL,
  contact_last_name text,
  contact_email text NOT NULL,
  contact_phone text,
  rooms jsonb NOT NULL,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  promo_code text,
  pricing jsonb NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  total_cents integer NOT NULL,
  deposit_cents integer NOT NULL,
  stripe_payment_intent_id text,
  checkout_payment_id uuid,
  client_id uuid,
  sub_trip_id uuid,
  booking_id uuid,
  group_signup_id uuid,
  terms_accepted_at timestamptz,
  ip_address text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_bookings_trip_idx ON public.group_bookings (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_bookings_pi_idx ON public.group_bookings (stripe_payment_intent_id);
GRANT SELECT, UPDATE ON public.group_bookings TO authenticated;
GRANT ALL ON public.group_bookings TO service_role;

CREATE OR REPLACE FUNCTION public.group_booking_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trip_addons_touch ON public.trip_addons;
CREATE TRIGGER trip_addons_touch BEFORE UPDATE ON public.trip_addons FOR EACH ROW EXECUTE FUNCTION public.group_booking_touch_updated_at();
DROP TRIGGER IF EXISTS group_bookings_touch ON public.group_bookings;
CREATE TRIGGER group_bookings_touch BEFORE UPDATE ON public.group_bookings FOR EACH ROW EXECUTE FUNCTION public.group_booking_touch_updated_at();

ALTER TABLE public.trip_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip owners manage addons" ON public.trip_addons;
CREATE POLICY "Trip owners manage addons" ON public.trip_addons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'office_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_addons.trip_id AND t.user_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'office_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_addons.trip_id AND t.user_id = auth.uid()));

DROP POLICY IF EXISTS "Trip owners view group bookings" ON public.group_bookings;
CREATE POLICY "Trip owners view group bookings" ON public.group_bookings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'office_admin'::app_role) OR user_id = auth.uid());
DROP POLICY IF EXISTS "Trip owners update group bookings" ON public.group_bookings;
CREATE POLICY "Trip owners update group bookings" ON public.group_bookings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'office_admin'::app_role) OR user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'office_admin'::app_role) OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.group_cabin_option_usage(p_trip_id uuid)
RETURNS TABLE (cabin_option_id uuid, rooms_taken integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (r->>'cabin_option_id')::uuid, COUNT(*)::int
    FROM public.group_bookings gb, jsonb_array_elements(gb.rooms) r
   WHERE gb.trip_id = p_trip_id
     AND (gb.status = 'deposit_paid' OR (gb.status = 'pending_payment' AND gb.created_at > now() - interval '30 minutes'))
   GROUP BY 1
$$;
REVOKE EXECUTE ON FUNCTION public.group_cabin_option_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.group_cabin_option_usage(uuid) TO service_role;