CREATE TABLE IF NOT EXISTS public.trip_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id uuid,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  overall_rating int CHECK (overall_rating BETWEEN 1 AND 5),
  accommodations_rating int CHECK (accommodations_rating BETWEEN 1 AND 5),
  activities_rating int CHECK (activities_rating BETWEEN 1 AND 5),
  communication_rating int CHECK (communication_rating BETWEEN 1 AND 5),
  value_rating int CHECK (value_rating BETWEEN 1 AND 5),
  review_text text,
  private_comments text,
  would_recommend boolean,
  allow_public_use boolean DEFAULT false,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trip_feedback_trip_unique ON public.trip_feedback(trip_id);
CREATE INDEX IF NOT EXISTS trip_feedback_user_idx ON public.trip_feedback(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_feedback TO authenticated;
GRANT ALL ON public.trip_feedback TO service_role;

ALTER TABLE public.trip_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own trip feedback" ON public.trip_feedback
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE TRIGGER trip_feedback_updated_at BEFORE UPDATE ON public.trip_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();