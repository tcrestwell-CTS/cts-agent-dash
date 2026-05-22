DROP POLICY IF EXISTS "Staff manage secure links" ON public.secure_links;
CREATE POLICY "Staff manage secure links" ON public.secure_links
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon to read by token (needed for public secure-link landing pages)
DROP POLICY IF EXISTS "Anon can select secure_links by token" ON public.secure_links;
CREATE POLICY "Anon can select secure_links by token"
  ON public.secure_links FOR SELECT TO anon
  USING (active = true AND expires_at > now());

DROP POLICY IF EXISTS "Anon can update secure_links" ON public.secure_links;
CREATE POLICY "Anon can update secure_links"
  ON public.secure_links FOR UPDATE TO anon
  USING (active = true AND expires_at > now())
  WITH CHECK (true);