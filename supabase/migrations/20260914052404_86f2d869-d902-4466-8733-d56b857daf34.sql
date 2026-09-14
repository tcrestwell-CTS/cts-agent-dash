CREATE TABLE public.academy_source_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  lesson_ids uuid[] NOT NULL DEFAULT '{}',
  extracted_text text,
  generated_draft text,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'published', 'failed')),
  error_message text,
  uploaded_by uuid NOT NULL,
  published_lesson_id uuid REFERENCES public.training_lessons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_source_materials TO authenticated;
GRANT ALL ON public.academy_source_materials TO service_role;
ALTER TABLE public.academy_source_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Academy staff can view source materials"
ON public.academy_source_materials FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Academy staff can create source materials"
ON public.academy_source_materials FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin')));
CREATE POLICY "Academy staff can update source materials"
ON public.academy_source_materials FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Academy staff can delete source materials"
ON public.academy_source_materials FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE TRIGGER academy_source_materials_updated_at
BEFORE UPDATE ON public.academy_source_materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Academy staff can view material files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'academy-materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin')));
CREATE POLICY "Academy staff can upload material files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'academy-materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin')));
CREATE POLICY "Academy staff can update material files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'academy-materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin')))
WITH CHECK (bucket_id = 'academy-materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin')));
CREATE POLICY "Academy staff can delete material files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'academy-materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin')));