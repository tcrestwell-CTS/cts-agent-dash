DROP POLICY IF EXISTS "agent_read_ip_logs" ON public.payment_ip_logs;

CREATE POLICY "Admins can read payment ip logs"
ON public.payment_ip_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Admins can update payment ip logs"
ON public.payment_ip_logs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));