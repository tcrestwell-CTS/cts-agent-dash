
-- Allow authenticated users to read reconciliation alerts
CREATE POLICY "Authenticated users can read reconciliation_alerts"
ON public.reconciliation_alerts
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update (resolve/dismiss) alerts
CREATE POLICY "Authenticated users can update reconciliation_alerts"
ON public.reconciliation_alerts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
