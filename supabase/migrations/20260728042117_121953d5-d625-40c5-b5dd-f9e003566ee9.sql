
-- app_config: add is_public flag, restrict broad reads
ALTER TABLE public.app_config ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Anonymous users can read public app_config" ON public.app_config;
DROP POLICY IF EXISTS "Authenticated users can read app_config" ON public.app_config;

CREATE POLICY "Anon can read public app_config"
  ON public.app_config FOR SELECT TO anon
  USING (is_public = true);

CREATE POLICY "Authenticated can read public app_config"
  ON public.app_config FOR SELECT TO authenticated
  USING (is_public = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));

-- agency_margin_rules: restrict SELECT to admins/office_admins
DROP POLICY IF EXISTS "Authenticated users read margin rules" ON public.agency_margin_rules;

CREATE POLICY "Admins and office admins read margin rules"
  ON public.agency_margin_rules FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));

-- qbo_account_mappings: restrict SELECT to finance staff
DROP POLICY IF EXISTS "Staff can read qbo_account_mappings" ON public.qbo_account_mappings;

CREATE POLICY "Finance staff can read qbo_account_mappings"
  ON public.qbo_account_mappings FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'office_admin'::app_role)
    OR has_role(auth.uid(), 'bookkeeper'::app_role)
    OR is_recon_admin()
  );
