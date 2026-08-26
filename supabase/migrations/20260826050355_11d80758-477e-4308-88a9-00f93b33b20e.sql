CREATE TABLE public.adx_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  adx_booking_ref text,
  adx_product_id text,
  product_title text NOT NULL,
  product_type text,
  destination text,
  travel_date date,
  return_date date,
  travelers integer NOT NULL DEFAULT 1,
  customer_name text,
  customer_email text,
  currency text NOT NULL DEFAULT 'USD',
  total_price numeric NOT NULL DEFAULT 0,
  net_price numeric,
  commission numeric,
  status text NOT NULL DEFAULT 'pending',
  raw_response jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adx_bookings TO authenticated;
GRANT ALL ON public.adx_bookings TO service_role;

ALTER TABLE public.adx_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own ADX bookings"
ON public.adx_bookings
FOR ALL TO authenticated
USING (auth.uid() = agent_id)
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Admins and bookkeepers read all ADX bookings"
ON public.adx_bookings
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'office_admin')
  OR public.has_role(auth.uid(), 'bookkeeper')
);

CREATE TRIGGER update_adx_bookings_updated_at
BEFORE UPDATE ON public.adx_bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();