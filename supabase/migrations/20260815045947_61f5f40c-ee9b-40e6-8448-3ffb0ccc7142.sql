CREATE TABLE public.project_expedition_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  pe_booking_ref text,
  pe_product_id text NOT NULL,
  product_title text NOT NULL,
  destination text,
  travel_date date,
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_expedition_bookings TO authenticated;
GRANT ALL ON public.project_expedition_bookings TO service_role;

ALTER TABLE public.project_expedition_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage their own PE bookings"
ON public.project_expedition_bookings FOR ALL TO authenticated
USING (agent_id = auth.uid())
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Admins view all PE bookings"
ON public.project_expedition_bookings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Admins manage all PE bookings"
ON public.project_expedition_bookings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_pe_bookings_agent ON public.project_expedition_bookings(agent_id);
CREATE INDEX idx_pe_bookings_trip ON public.project_expedition_bookings(trip_id);

CREATE TRIGGER update_pe_bookings_updated_at
BEFORE UPDATE ON public.project_expedition_bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();