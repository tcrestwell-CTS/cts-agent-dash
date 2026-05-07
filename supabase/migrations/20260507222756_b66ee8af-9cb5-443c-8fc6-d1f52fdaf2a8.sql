CREATE OR REPLACE FUNCTION public.is_invoice_cash_payment(p public.trip_payments)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.status = 'paid'
    AND (
      p.due_date IS NULL
      OR p.payment_method IS NOT NULL
      OR p.stripe_session_id IS NOT NULL
      OR p.stripe_receipt_url IS NOT NULL
      OR p.payment_type IN ('deposit', 'payment', 'authorization', 'other')
      OR COALESCE(p.details, '') ILIKE '%stripe payment%'
      OR COALESCE(p.details, '') ILIKE '%card:%'
      OR COALESCE(p.details, '') ILIKE '%cash%'
      OR COALESCE(p.details, '') ILIKE '%check%'
    )
    AND NOT (
      p.due_date IS NOT NULL
      AND p.payment_method IS NULL
      AND p.stripe_session_id IS NULL
      AND p.stripe_receipt_url IS NULL
      AND p.payment_type IN ('installment', 'final', 'final_balance')
      AND COALESCE(p.details, '') ILIKE 'installment%'
    );
$$;

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
  FROM public.trip_payments p
  WHERE p.trip_id = v_trip_id
    AND public.is_invoice_cash_payment(p);

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
AFTER INSERT OR UPDATE OF status, amount, due_date, payment_method, stripe_session_id, stripe_receipt_url, details OR DELETE ON public.trip_payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_from_trip_payments();

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
  SELECT i2.id AS invoice_id, COALESCE(SUM(p.amount) FILTER (WHERE public.is_invoice_cash_payment(p)), 0) AS paid
  FROM public.invoices i2
  LEFT JOIN public.trip_payments p ON p.trip_id = i2.trip_id
  GROUP BY i2.id
) sub
WHERE i.id = sub.invoice_id;