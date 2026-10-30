ALTER TABLE public.trip_payments ADD COLUMN IF NOT EXISTS refunded_at date, ADD COLUMN IF NOT EXISTS refund_reason text, ADD COLUMN IF NOT EXISTS qbo_refund_id text;

CREATE OR REPLACE FUNCTION public.trigger_qbo_client_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
BEGIN
  IF NEW.status = 'refunded' AND OLD.status = 'paid' AND NEW.qbo_refund_id IS NULL THEN
    PERFORM public._post_qbo_sync_trigger('client_payment_refunded', to_jsonb(NEW), to_jsonb(OLD));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_qbo_client_refund ON public.trip_payments;
CREATE TRIGGER trg_qbo_client_refund AFTER UPDATE OF status ON public.trip_payments
FOR EACH ROW EXECUTE FUNCTION public.trigger_qbo_client_refund();