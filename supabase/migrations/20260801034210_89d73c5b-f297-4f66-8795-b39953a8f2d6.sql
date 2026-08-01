CREATE TABLE public.client_call_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  call_date date NOT NULL DEFAULT CURRENT_DATE,
  call_type text NOT NULL DEFAULT 'phone',
  title text NOT NULL DEFAULT 'Client call',
  summary text,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_up_date date,
  sentiment text,
  transcript text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_call_notes TO authenticated;
GRANT ALL ON public.client_call_notes TO service_role;

ALTER TABLE public.client_call_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage call notes for their clients"
ON public.client_call_notes FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_call_notes.client_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_call_notes.client_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all call notes"
ON public.client_call_notes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE INDEX idx_client_call_notes_client ON public.client_call_notes(client_id, call_date DESC);

CREATE TRIGGER update_client_call_notes_updated_at
BEFORE UPDATE ON public.client_call_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();