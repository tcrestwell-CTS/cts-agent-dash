-- Grant bookkeepers UPDATE access to commissions so the "mark received"
-- settle action works when a bookkeeper is signed in. Read + admin write
-- policies already exist; this closes the settle gap without loosening
-- office_admin (who remain read-only per Step 7 spec).
CREATE POLICY "Bookkeepers can update commissions"
  ON public.commissions
  FOR UPDATE
  TO authenticated
  USING (public.is_bookkeeper(auth.uid()))
  WITH CHECK (public.is_bookkeeper(auth.uid()));