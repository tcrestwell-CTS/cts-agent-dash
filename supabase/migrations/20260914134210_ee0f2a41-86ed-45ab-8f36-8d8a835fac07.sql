CREATE TABLE public.academy_clia_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('stateroom_booking','ship_inspection','personal_cruise','course_credit')),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  cruise_line TEXT,
  nights INTEGER,
  credits NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_clia_activity TO authenticated;
GRANT ALL ON public.academy_clia_activity TO service_role;

ALTER TABLE public.academy_clia_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors manage their own CLIA activity"
ON public.academy_clia_activity FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all CLIA activity"
ON public.academy_clia_activity FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE INDEX idx_academy_clia_activity_user ON public.academy_clia_activity (user_id, kind);

CREATE TRIGGER update_academy_clia_activity_updated_at
BEFORE UPDATE ON public.academy_clia_activity
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();