CREATE TABLE public.ratehawk_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  partner_order_id text NOT NULL UNIQUE,
  rh_order_id bigint,
  rh_item_id bigint,
  hid bigint,
  hotel_id text,
  hotel_name text,
  room_name text,
  checkin date NOT NULL,
  checkout date NOT NULL,
  residency text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  search_guests jsonb NOT NULL DEFAULT '[]'::jsonb,
  rooms jsonb,
  contact jsonb,
  source_hash text,
  book_hash text,
  search_amount numeric(12,2),
  prebook_amount numeric(12,2),
  price_changed boolean NOT NULL DEFAULT false,
  price_change_pct numeric(8,3),
  policy_changed boolean NOT NULL DEFAULT false,
  price_change_accepted boolean NOT NULL DEFAULT false,
  search_cancellation jsonb,
  prebook_cancellation jsonb,
  rh_payment_type jsonb,
  guest_deposit_amount numeric(12,2),
  stripe_payment_intent_id text UNIQUE,
  payment_status text NOT NULL DEFAULT 'unpaid',
  status text NOT NULL DEFAULT 'prebooked',
  last_error text,
  finish_attempts integer NOT NULL DEFAULT 0,
  last_status_payload jsonb,
  raw_prebook jsonb,
  raw_form jsonb,
  booked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ratehawk_orders TO authenticated;
GRANT ALL ON public.ratehawk_orders TO service_role;
ALTER TABLE public.ratehawk_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins can view ratehawk orders" ON public.ratehawk_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_recon_admin());
CREATE INDEX idx_rh_orders_user ON public.ratehawk_orders (user_id);
CREATE INDEX idx_rh_orders_status ON public.ratehawk_orders (status);
CREATE TRIGGER update_ratehawk_orders_updated_at BEFORE UPDATE ON public.ratehawk_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();