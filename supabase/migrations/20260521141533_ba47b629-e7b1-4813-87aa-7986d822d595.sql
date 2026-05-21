
-- Create private storage bucket for financial packet PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-packets', 'financial-packets', false)
ON CONFLICT (id) DO NOTHING;

-- Admin + bookkeeper can read packet files
DROP POLICY IF EXISTS "fin_packets_read" ON storage.objects;
CREATE POLICY "fin_packets_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'financial-packets'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_bookkeeper(auth.uid())
    )
  );

-- Admins can upload packet files (edge function uses service role which bypasses anyway)
DROP POLICY IF EXISTS "fin_packets_insert" ON storage.objects;
CREATE POLICY "fin_packets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'financial-packets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "fin_packets_update" ON storage.objects;
CREATE POLICY "fin_packets_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'financial-packets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "fin_packets_delete" ON storage.objects;
CREATE POLICY "fin_packets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'financial-packets'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
