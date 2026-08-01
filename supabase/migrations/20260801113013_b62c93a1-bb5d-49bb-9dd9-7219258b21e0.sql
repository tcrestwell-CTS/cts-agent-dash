CREATE POLICY "Public form uploads insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'form-uploads');

CREATE POLICY "Team reads form uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'form-uploads');

CREATE POLICY "Team deletes form uploads" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'form-uploads');