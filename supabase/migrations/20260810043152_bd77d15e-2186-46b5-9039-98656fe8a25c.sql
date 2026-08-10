CREATE POLICY "Admins can manage all logos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1]);