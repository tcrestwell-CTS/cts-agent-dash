
CREATE TABLE IF NOT EXISTS public.invoice_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qbo_invoice_id TEXT NOT NULL,
  invoice_id UUID,
  trip_id UUID,
  client_id UUID,
  recipient_email TEXT NOT NULL,
  email_kind TEXT NOT NULL CHECK (email_kind IN ('initial','reminder_7d','test','manual')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_id TEXT,
  due_date DATE,
  amount NUMERIC,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_email_log_qbo ON public.invoice_email_log(qbo_invoice_id, email_kind);
CREATE INDEX IF NOT EXISTS idx_inv_email_log_trip ON public.invoice_email_log(trip_id);

ALTER TABLE public.invoice_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invoice email log"
  ON public.invoice_email_log FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Service role full access invoice email log"
  ON public.invoice_email_log FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
