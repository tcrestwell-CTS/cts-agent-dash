
-- ────────────────────────────────────────────────────────────────────────────
-- Helper to POST to qbo-sync-trigger from any trigger
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._post_qbo_sync_trigger(p_trigger_type text, p_record jsonb, p_old jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _service_key text;
BEGIN
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  PERFORM net.http_post(
    url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/qbo-sync-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'trigger_type', p_trigger_type,
      'record', p_record,
      'old_record', p_old
    )
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. New client → QBO Customer
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_qbo_client_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public._post_qbo_sync_trigger('client_created', row_to_json(NEW)::jsonb);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qbo_sync_client_created ON public.clients;
CREATE TRIGGER qbo_sync_client_created
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.trigger_qbo_client_created();

-- ────────────────────────────────────────────────────────────────────────────
-- 2. New supplier → QBO Vendor
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_qbo_supplier_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public._post_qbo_sync_trigger('supplier_created', row_to_json(NEW)::jsonb);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qbo_sync_supplier_created ON public.suppliers;
CREATE TRIGGER qbo_sync_supplier_created
  AFTER INSERT ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.trigger_qbo_supplier_created();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Loan installment paid → linked pair of QBO Bank Deposits
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_qbo_loan_repayment_posted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    PERFORM public._post_qbo_sync_trigger(
      'loan_repayment_posted',
      row_to_json(NEW)::jsonb,
      row_to_json(OLD)::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qbo_sync_loan_repayment_posted ON public.loan_payment_schedules;
CREATE TRIGGER qbo_sync_loan_repayment_posted
  AFTER UPDATE ON public.loan_payment_schedules
  FOR EACH ROW EXECUTE FUNCTION public.trigger_qbo_loan_repayment_posted();
