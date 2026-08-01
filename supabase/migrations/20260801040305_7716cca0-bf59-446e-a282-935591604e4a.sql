
CREATE TABLE public.library_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'itinerary',
  name text NOT NULL,
  description text,
  destination text,
  trip_type text,
  duration_days integer,
  content text,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  is_shared boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_templates_kind_check CHECK (kind IN ('itinerary','proposal','email','packing','checklist'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_templates TO authenticated;
GRANT ALL ON public.library_templates TO service_role;

ALTER TABLE public.library_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view shared templates"
  ON public.library_templates FOR SELECT TO authenticated
  USING ((is_shared = true AND is_archived = false) OR created_by = auth.uid()
         OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Users can create templates"
  ON public.library_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners and admins can update templates"
  ON public.library_templates FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Owners and admins can delete templates"
  ON public.library_templates FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));

CREATE INDEX idx_library_templates_kind ON public.library_templates(kind) WHERE is_archived = false;
CREATE INDEX idx_library_templates_created_by ON public.library_templates(created_by);

CREATE TRIGGER update_library_templates_updated_at
  BEFORE UPDATE ON public.library_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.marketing_image_assets ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

CREATE POLICY "Team can view shared image assets"
  ON public.marketing_image_assets FOR SELECT TO authenticated
  USING (is_shared = true);
