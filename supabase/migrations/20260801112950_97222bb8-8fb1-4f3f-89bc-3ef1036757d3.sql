CREATE TABLE public.intake_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  slug text NOT NULL UNIQUE,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  thank_you_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_forms TO authenticated;
GRANT SELECT ON public.intake_forms TO anon;
GRANT ALL ON public.intake_forms TO service_role;
ALTER TABLE public.intake_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their forms" ON public.intake_forms
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Anyone can view active forms" ON public.intake_forms
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE TRIGGER update_intake_forms_updated_at
  BEFORE UPDATE ON public.intake_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.intake_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.intake_forms(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  submitter_name text,
  submitter_email text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intake_form_responses_form ON public.intake_form_responses(form_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_form_responses TO authenticated;
GRANT INSERT ON public.intake_form_responses TO anon;
GRANT ALL ON public.intake_form_responses TO service_role;
ALTER TABLE public.intake_form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit to active forms" ON public.intake_form_responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.intake_forms f WHERE f.id = form_id AND f.is_active = true));

CREATE POLICY "Form owners read responses" ON public.intake_form_responses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intake_forms f WHERE f.id = form_id AND (f.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))));

CREATE POLICY "Form owners delete responses" ON public.intake_form_responses
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intake_forms f WHERE f.id = form_id AND (f.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))));