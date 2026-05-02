-- Recreate cc_authorizations policies scoped to the authenticated role (defense-in-depth)
DROP POLICY IF EXISTS "Admins can delete all cc authorizations" ON public.cc_authorizations;
DROP POLICY IF EXISTS "Admins can update all cc authorizations" ON public.cc_authorizations;
DROP POLICY IF EXISTS "Admins can view all cc authorizations" ON public.cc_authorizations;
DROP POLICY IF EXISTS "Office admins can view all cc authorizations" ON public.cc_authorizations;
DROP POLICY IF EXISTS "Users can delete their own cc authorizations" ON public.cc_authorizations;
DROP POLICY IF EXISTS "Users can insert their own cc authorizations" ON public.cc_authorizations;
DROP POLICY IF EXISTS "Users can update their own cc authorizations" ON public.cc_authorizations;
DROP POLICY IF EXISTS "Users can view their own cc authorizations" ON public.cc_authorizations;

CREATE POLICY "Admins can delete all cc authorizations"
  ON public.cc_authorizations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all cc authorizations"
  ON public.cc_authorizations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all cc authorizations"
  ON public.cc_authorizations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admins can view all cc authorizations"
  ON public.cc_authorizations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Users can delete their own cc authorizations"
  ON public.cc_authorizations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cc authorizations"
  ON public.cc_authorizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cc authorizations"
  ON public.cc_authorizations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own cc authorizations"
  ON public.cc_authorizations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);