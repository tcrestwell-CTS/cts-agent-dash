
CREATE TABLE public.client_line_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  margin_line_id uuid NOT NULL REFERENCES public.booking_margin_lines(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  selected boolean NOT NULL DEFAULT true,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, margin_line_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_line_selections TO authenticated;
GRANT ALL ON public.client_line_selections TO service_role;

ALTER TABLE public.client_line_selections ENABLE ROW LEVEL SECURITY;

-- Trip-owning agent can read/manage selections for their trips
CREATE POLICY "Agents can view selections for their trips"
ON public.client_line_selections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = client_line_selections.trip_id
      AND t.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
);

CREATE POLICY "Agents can manage selections for their trips"
ON public.client_line_selections FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = client_line_selections.trip_id
      AND t.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = client_line_selections.trip_id
      AND t.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
);

CREATE TRIGGER update_client_line_selections_updated_at
BEFORE UPDATE ON public.client_line_selections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_selection_locked_at timestamptz;
