
-- 1. Fix is_recon_admin: add fixed search_path
CREATE OR REPLACE FUNCTION public.is_recon_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'office_admin')
  );
$function$;

-- 2. secure_links: remove anon SELECT/UPDATE; service role / staff only
DROP POLICY IF EXISTS "Anon can select secure_links by token" ON public.secure_links;
DROP POLICY IF EXISTS "Anon can update secure_links" ON public.secure_links;

-- 3. contact_messages: restrict reads/updates to admin/office_admin
DROP POLICY IF EXISTS "Auth users can view all" ON public.contact_messages;
DROP POLICY IF EXISTS "Auth users can update" ON public.contact_messages;

CREATE POLICY "Admins can view contact messages"
ON public.contact_messages FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Admins can update contact messages"
ON public.contact_messages FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

-- 4. quote_requests: restrict reads/updates to admin/office_admin
DROP POLICY IF EXISTS "Auth users can view all" ON public.quote_requests;
DROP POLICY IF EXISTS "Auth users can update" ON public.quote_requests;

CREATE POLICY "Admins can view quote requests"
ON public.quote_requests FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Admins can update quote requests"
ON public.quote_requests FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

-- 5. reconciliation_alerts: remove the overly-permissive UPDATE and duplicate SELECT
DROP POLICY IF EXISTS "Authenticated users can update reconciliation_alerts" ON public.reconciliation_alerts;
DROP POLICY IF EXISTS "Authenticated can read reconciliation alerts" ON public.reconciliation_alerts;
DROP POLICY IF EXISTS "Authenticated users can read reconciliation_alerts" ON public.reconciliation_alerts;

CREATE POLICY "Admins can view all reconciliation alerts"
ON public.reconciliation_alerts FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Admins can update any reconciliation alert"
ON public.reconciliation_alerts FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

-- 6. trip_nurture_steps: remove public-role full-access policy; service role bypasses RLS anyway
DROP POLICY IF EXISTS "Service role full access nurture steps" ON public.trip_nurture_steps;

-- 7. storage cc-signatures: scope SELECT to owner's folder
DROP POLICY IF EXISTS "Authenticated users can view cc signatures" ON storage.objects;

CREATE POLICY "Users can view their own cc signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cc-signatures'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all cc signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cc-signatures'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
);
