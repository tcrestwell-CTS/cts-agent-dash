
-- 1. agent_messages: restrict team channel reads to users with a role
DROP POLICY IF EXISTS "Users can read team messages" ON public.agent_messages;
CREATE POLICY "Staff can read team messages"
ON public.agent_messages
FOR SELECT
TO authenticated
USING (
  channel = 'team'
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
);

-- 2. booking_margin_audit: restrict INSERT to service_role only
-- (calculate_booking_margin is SECURITY DEFINER owned by superuser, bypasses RLS)
DROP POLICY IF EXISTS "System inserts audit" ON public.booking_margin_audit;
CREATE POLICY "Service role inserts audit"
ON public.booking_margin_audit
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. client_portal_sessions: revoke token/email column access from authenticated;
-- only service_role (edge functions) may read sensitive credentials.
REVOKE SELECT ON public.client_portal_sessions FROM authenticated;
GRANT SELECT (id, client_id, expires_at, verified_at, created_at, unread_message_count)
  ON public.client_portal_sessions TO authenticated;

-- 4. recon_audit_log: restrict INSERT to admin/office_admin/bookkeeper service callers,
-- and require actor_id = auth.uid() to prevent forging.
DROP POLICY IF EXISTS "Service role can insert audit log" ON public.recon_audit_log;
CREATE POLICY "Service role can insert audit log"
ON public.recon_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Recon staff can insert audit log"
ON public.recon_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
    OR public.is_bookkeeper(auth.uid())
  )
);

-- 5. trip_insurance_responses: remove unrestricted anon insert; only service_role can write.
-- (Client portal submissions must go through an edge function.)
DROP POLICY IF EXISTS "Clients can insert insurance responses" ON public.trip_insurance_responses;
CREATE POLICY "Service role inserts insurance responses"
ON public.trip_insurance_responses
FOR INSERT
TO service_role
WITH CHECK (true);

-- 6. widgety_cruise_prices: restrict writes to admin/office_admin; agents keep read.
DROP POLICY IF EXISTS "agents can upsert cruise prices" ON public.widgety_cruise_prices;

CREATE POLICY "Admins can insert cruise prices"
ON public.widgety_cruise_prices
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
);

CREATE POLICY "Admins can update cruise prices"
ON public.widgety_cruise_prices
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
);

CREATE POLICY "Admins can delete cruise prices"
ON public.widgety_cruise_prices
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
);
