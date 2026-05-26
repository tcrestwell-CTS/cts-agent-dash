
-- ============ agencies: owner/admin SELECT only ============
DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;
CREATE POLICY "Users can view their own agency"
  ON public.agencies FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

-- ============ agency_settings: owner/admin SELECT only ============
DROP POLICY IF EXISTS "Authenticated users can view agency settings" ON public.agency_settings;
CREATE POLICY "Users can view their own agency settings"
  ON public.agency_settings FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

-- ============ invitations: only see your own invite ============
DROP POLICY IF EXISTS "Authenticated users can check pending invitations" ON public.invitations;
-- "Users can view invitations for their email" already exists and is correctly scoped.

-- ============ car_rental_requests: scope to assigned agent or admins ============
DROP POLICY IF EXISTS "agent_full_access" ON public.car_rental_requests;
DROP POLICY IF EXISTS "Authenticated agents can view car rental requests" ON public.car_rental_requests;
DROP POLICY IF EXISTS "Authenticated agents can update car rental requests" ON public.car_rental_requests;
DROP POLICY IF EXISTS "Authenticated agents can delete car rental requests" ON public.car_rental_requests;
DROP POLICY IF EXISTS "Authenticated agents can insert car rental requests" ON public.car_rental_requests;

CREATE POLICY "Assigned agent or admin can view car rental requests"
  ON public.car_rental_requests FOR SELECT TO authenticated
  USING (
    auth.uid() = assigned_agent
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

CREATE POLICY "Authenticated can create car rental requests"
  ON public.car_rental_requests FOR INSERT TO authenticated
  WITH CHECK (
    assigned_agent IS NULL
    OR auth.uid() = assigned_agent
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

CREATE POLICY "Assigned agent or admin can update car rental requests"
  ON public.car_rental_requests FOR UPDATE TO authenticated
  USING (
    auth.uid() = assigned_agent
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  )
  WITH CHECK (
    auth.uid() = assigned_agent
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

CREATE POLICY "Admin can delete car rental requests"
  ON public.car_rental_requests FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

-- ============ rental_payment_tokens: service role only ============
DROP POLICY IF EXISTS "anon_read_own_token" ON public.rental_payment_tokens;
DROP POLICY IF EXISTS "anon_select_rental_tokens" ON public.rental_payment_tokens;
DROP POLICY IF EXISTS "anon_update_rental_tokens" ON public.rental_payment_tokens;
DROP POLICY IF EXISTS "agents_full_access_rental_tokens" ON public.rental_payment_tokens;
-- "service_role_all" remains; edge functions handle token validation.

-- ============ secure_links: service role only ============
DROP POLICY IF EXISTS "Staff manage secure links" ON public.secure_links;
-- "Service role manages secure links" remains.

-- ============ win_entries & lead_magnet_subscribers: admin-only read ============
DROP POLICY IF EXISTS "agents can read" ON public.win_entries;
CREATE POLICY "Admins can read win entries"
  ON public.win_entries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

DROP POLICY IF EXISTS "agents can read" ON public.lead_magnet_subscribers;
CREATE POLICY "Admins can read lead magnet subscribers"
  ON public.lead_magnet_subscribers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

-- ============ Fix mutable search_path on functions ============
ALTER FUNCTION public.generate_application_number() SET search_path = public;
ALTER FUNCTION public.is_authenticated() SET search_path = public;
ALTER FUNCTION public.update_loan_updated_at() SET search_path = public;
ALTER FUNCTION public.update_recon_updated_at() SET search_path = public;
ALTER FUNCTION public.notify_chris_booked() SET search_path = public, extensions;
ALTER FUNCTION public.notify_marcus_booked() SET search_path = public, extensions;
ALTER FUNCTION public.notify_terrance_proposal() SET search_path = public, extensions;
ALTER FUNCTION public.notify_n8n_qualified_lead() SET search_path = public, extensions;
ALTER FUNCTION public.notify_kandi_booking_change() SET search_path = public, extensions;
ALTER FUNCTION public.notify_kandi_commission_change() SET search_path = public, extensions;
ALTER FUNCTION public.notify_kandi_invoice_change() SET search_path = public, extensions;
