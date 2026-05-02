
-- Function: recalc invoice paid/remaining/status from trip_payments
CREATE OR REPLACE FUNCTION public.sync_invoice_from_trip_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trip_id uuid;
  v_paid numeric;
  v_invoice_id uuid;
  v_total numeric;
  v_remaining numeric;
  v_status text;
BEGIN
  v_trip_id := COALESCE(NEW.trip_id, OLD.trip_id);
  IF v_trip_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id, total_amount INTO v_invoice_id, v_total
  FROM public.invoices
  WHERE trip_id = v_trip_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.trip_payments
  WHERE trip_id = v_trip_id AND status = 'paid';

  v_remaining := GREATEST(COALESCE(v_total, 0) - v_paid, 0);

  v_status := CASE
    WHEN v_paid <= 0 THEN 'sent'
    WHEN v_remaining <= 0.01 THEN 'paid'
    ELSE 'partial'
  END;

  UPDATE public.invoices
  SET amount_paid = v_paid,
      amount_remaining = v_remaining,
      status = v_status,
      updated_at = now()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_from_trip_payments ON public.trip_payments;
CREATE TRIGGER trg_sync_invoice_from_trip_payments
AFTER INSERT OR UPDATE OF status, amount OR DELETE ON public.trip_payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_from_trip_payments();

-- Backfill existing invoices using the same logic
UPDATE public.invoices i
SET amount_paid = sub.paid,
    amount_remaining = GREATEST(i.total_amount - sub.paid, 0),
    status = CASE
      WHEN sub.paid <= 0 THEN 'sent'
      WHEN GREATEST(i.total_amount - sub.paid, 0) <= 0.01 THEN 'paid'
      ELSE 'partial'
    END,
    updated_at = now()
FROM (
  SELECT trip_id, COALESCE(SUM(amount), 0) AS paid
  FROM public.trip_payments
  WHERE status = 'paid'
  GROUP BY trip_id
) sub
WHERE i.trip_id = sub.trip_id;
