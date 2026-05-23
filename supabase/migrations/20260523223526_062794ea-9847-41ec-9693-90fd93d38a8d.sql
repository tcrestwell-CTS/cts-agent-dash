DROP POLICY IF EXISTS admin_generate ON public.financial_packets;
DROP POLICY IF EXISTS admin_update ON public.financial_packets;

CREATE POLICY admin_bookkeeper_generate ON public.financial_packets
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_bookkeeper(auth.uid()));

CREATE POLICY admin_bookkeeper_update ON public.financial_packets
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_bookkeeper(auth.uid()));