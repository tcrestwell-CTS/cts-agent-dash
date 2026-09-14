CREATE TABLE public.academy_material_lesson_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.academy_source_materials(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.training_lessons(id) ON DELETE CASCADE,
  generated_draft text,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'processing', 'ready', 'published', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(material_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_material_lesson_drafts TO authenticated;
GRANT ALL ON public.academy_material_lesson_drafts TO service_role;
ALTER TABLE public.academy_material_lesson_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Academy staff can view lesson drafts"
ON public.academy_material_lesson_drafts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Academy staff can create lesson drafts"
ON public.academy_material_lesson_drafts FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Academy staff can update lesson drafts"
ON public.academy_material_lesson_drafts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Academy staff can delete lesson drafts"
ON public.academy_material_lesson_drafts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE TRIGGER academy_material_lesson_drafts_updated_at
BEFORE UPDATE ON public.academy_material_lesson_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.training_lessons
ADD COLUMN content_source_name text,
ADD COLUMN content_source_updated_at timestamptz;