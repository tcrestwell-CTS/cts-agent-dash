CREATE TABLE public.excursion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  agent_user_id uuid,
  product_code text NOT NULL,
  product_title text,
  destination text,
  product_url text,
  image_url text,
  travel_date date,
  travelers integer NOT NULL DEFAULT 2,
  price_per_person numeric,
  currency text NOT NULL DEFAULT 'USD',
  estimated_total numeric,
  estimated_commission numeric,
  client_notes text,
  agent_notes text,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_excursion_requests_client ON public.excursion_requests(client_id);
CREATE INDEX idx_excursion_requests_trip ON public.excursion_requests(trip_id);
CREATE INDEX idx_excursion_requests_status ON public.excursion_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.excursion_requests TO authenticated;
GRANT ALL ON public.excursion_requests TO service_role;

ALTER TABLE public.excursion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients view own excursion requests"
ON public.excursion_requests FOR SELECT TO authenticated
USING (
  client_id IN (
    SELECT cp.client_id FROM public.client_profiles cp WHERE cp.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Clients create own excursion requests"
ON public.excursion_requests FOR INSERT TO authenticated
WITH CHECK (
  client_id IN (
    SELECT cp.client_id FROM public.client_profiles cp WHERE cp.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Agents view their clients excursion requests"
ON public.excursion_requests FOR SELECT TO authenticated
USING (
  agent_user_id = auth.uid()
  OR client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'office_admin')
);

CREATE POLICY "Agents manage their clients excursion requests"
ON public.excursion_requests FOR UPDATE TO authenticated
USING (
  agent_user_id = auth.uid()
  OR client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'office_admin')
);

CREATE POLICY "Admins delete excursion requests"
ON public.excursion_requests FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'office_admin')
);

CREATE TRIGGER update_excursion_requests_updated_at
BEFORE UPDATE ON public.excursion_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();