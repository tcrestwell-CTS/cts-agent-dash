DROP POLICY IF EXISTS "anon_insert_ip_logs" ON public.payment_ip_logs;
CREATE POLICY "anon_insert_ip_logs" ON public.payment_ip_logs
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "agent_read_ip_logs" ON public.payment_ip_logs;
CREATE POLICY "agent_read_ip_logs" ON public.payment_ip_logs
  FOR SELECT TO authenticated USING (true);

GRANT INSERT ON public.payment_ip_logs TO anon;
GRANT SELECT ON public.payment_ip_logs TO authenticated;