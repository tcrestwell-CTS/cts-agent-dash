ALTER TABLE public.training_phases ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'crm';
ALTER TABLE public.training_modules_v2 ADD COLUMN IF NOT EXISTS unlock_after_module_id uuid REFERENCES public.training_modules_v2(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.training_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'Reference',
  category text NOT NULL DEFAULT 'Handbooks',
  file_url text,
  size_label text,
  track text NOT NULL DEFAULT 'academy',
  sort_order integer NOT NULL DEFAULT 0,
  updated_on date NOT NULL DEFAULT current_date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_resources TO authenticated;
GRANT ALL ON public.training_resources TO service_role;
ALTER TABLE public.training_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read resources" ON public.training_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage resources" ON public.training_resources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE TABLE IF NOT EXISTS public.training_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  credential_prefix text NOT NULL,
  track text NOT NULL DEFAULT 'academy',
  required_module_ids uuid[] NOT NULL DEFAULT '{}',
  requirement_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_certificates TO authenticated;
GRANT ALL ON public.training_certificates TO service_role;
ALTER TABLE public.training_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read certificate catalogue" ON public.training_certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage certificate catalogue" ON public.training_certificates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE TABLE IF NOT EXISTS public.training_user_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  certificate_id uuid NOT NULL REFERENCES public.training_certificates(id) ON DELETE CASCADE,
  credential_id text NOT NULL,
  issued_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, certificate_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_user_certificates TO authenticated;
GRANT ALL ON public.training_user_certificates TO service_role;
ALTER TABLE public.training_user_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own certificates" ON public.training_user_certificates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Users earn own certificates" ON public.training_user_certificates FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage issued certificates" ON public.training_user_certificates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE TRIGGER trg_training_resources_updated_at BEFORE UPDATE ON public.training_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_training_certificates_updated_at BEFORE UPDATE ON public.training_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();