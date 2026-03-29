
-- Table to store reconciliation alerts raised by Agent Kandi
CREATE TABLE public.reconciliation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL,  -- 'missing_invoice', 'unpaid_balance', 'deposit_overdue', 'status_mismatch', 'commission_variance', 'qbo_desync'
  severity TEXT NOT NULL DEFAULT 'warning',  -- 'info', 'warning', 'critical'
  entity_type TEXT NOT NULL,  -- 'booking', 'invoice', 'trip', 'commission', 'payment'
  entity_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON public.reconciliation_alerts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own alerts" ON public.reconciliation_alerts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_reconciliation_alerts_user_resolved ON public.reconciliation_alerts (user_id, resolved, created_at DESC);

-- Trigger to call Kandi on booking changes
CREATE OR REPLACE FUNCTION public.notify_kandi_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _service_key text;
BEGIN
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  PERFORM net.http_post(
    url     := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/kandi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body    := jsonb_build_object(
      'trigger', 'booking_change',
      'record', row_to_json(NEW)::jsonb,
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_kandi_booking
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_kandi_booking_change();

-- Trigger on invoice changes
CREATE OR REPLACE FUNCTION public.notify_kandi_invoice_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _service_key text;
BEGIN
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  PERFORM net.http_post(
    url     := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/kandi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body    := jsonb_build_object(
      'trigger', 'invoice_change',
      'record', row_to_json(NEW)::jsonb,
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_kandi_invoice
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.notify_kandi_invoice_change();

-- Trigger on commission changes
CREATE OR REPLACE FUNCTION public.notify_kandi_commission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _service_key text;
BEGIN
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  PERFORM net.http_post(
    url     := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/kandi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body    := jsonb_build_object(
      'trigger', 'commission_change',
      'record', row_to_json(NEW)::jsonb,
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_kandi_commission
  AFTER INSERT OR UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_kandi_commission_change();

-- Daily sweep cron job (runs at 6 AM UTC)
SELECT cron.schedule(
  'kandi-daily-sweep',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/kandi',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidG51bHp2d3JlcXpibXh1bHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjkzMjksImV4cCI6MjA4NjAwNTMyOX0.0PJACAXw8c8ik3_UBpBEGWXBxfLbMxh3jP1brMCCpGU"}'::jsonb,
    body := '{"trigger":"daily_sweep"}'::jsonb
  ) AS request_id;
  $$
);
