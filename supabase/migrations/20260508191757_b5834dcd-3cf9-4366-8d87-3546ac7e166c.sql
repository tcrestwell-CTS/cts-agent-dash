
-- Marketing image library: queryable index over the email-assets bucket
CREATE TABLE IF NOT EXISTS public.marketing_image_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  public_url text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes integer,
  width integer,
  height integer,
  alt_text text,
  tags text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_image_assets_created_at
  ON public.marketing_image_assets(created_at DESC);

ALTER TABLE public.marketing_image_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read marketing images"
  ON public.marketing_image_assets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert marketing images"
  ON public.marketing_image_assets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can update marketing images"
  ON public.marketing_image_assets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete marketing images"
  ON public.marketing_image_assets FOR DELETE TO authenticated USING (true);

-- Storage policies for email-assets bucket (public bucket, but write access needs policies)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='email-assets authenticated upload') THEN
    CREATE POLICY "email-assets authenticated upload"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'email-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='email-assets authenticated update') THEN
    CREATE POLICY "email-assets authenticated update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'email-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='email-assets authenticated delete') THEN
    CREATE POLICY "email-assets authenticated delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'email-assets');
  END IF;
END $$;
