CREATE OR REPLACE FUNCTION public.sync_invoice_from_trip_payments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trip_id uuid;
  v_paid numeric;
  v_all_paid numeric;
  v_benchmark numeric;
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

  -- Every recorded paid row, including installments that were marked paid
  -- without a payment method or Stripe reference.
  SELECT COALESCE(SUM(amount), 0) INTO v_all_paid
  FROM public.trip_payments p
  WHERE p.trip_id = v_trip_id
    AND p.status = 'paid';

  SELECT COALESCE(NULLIF(total_gross_sales, 0), v_total) INTO v_benchmark
  FROM public.trips WHERE id = v_trip_id;
  v_benchmark := COALESCE(v_benchmark, v_total);

  -- If all money received covers the trip price, the invoice is settled in full.
  IF COALESCE(v_benchmark, 0) > 0 AND v_all_paid >= v_benchmark - 0.01 THEN
    v_paid := GREATEST(v_paid, COALESCE(v_total, 0));
  END IF;

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
$function$;

-- Backfill existing invoices with the corrected rule.
WITH calc AS (
  SELECT i.id,
         i.total_amount,
         COALESCE((SELECT SUM(p.amount) FROM public.trip_payments p
                   WHERE p.trip_id = i.trip_id AND public.is_invoice_cash_payment(p)), 0) AS cash_paid,
         COALESCE((SELECT SUM(p.amount) FROM public.trip_payments p
                   WHERE p.trip_id = i.trip_id AND p.status = 'paid'), 0) AS all_paid,
         COALESCE(NULLIF(t.total_gross_sales, 0), i.total_amount) AS benchmark
  FROM public.invoices i
  LEFT JOIN public.trips t ON t.id = i.trip_id
  WHERE i.trip_id IS NOT NULL
), final AS (
  SELECT id,
         total_amount,
         CASE WHEN COALESCE(benchmark,0) > 0 AND all_paid >= benchmark - 0.01
              THEN GREATEST(cash_paid, COALESCE(total_amount,0))
              ELSE cash_paid END AS paid
  FROM calc
)
UPDATE public.invoices i
SET amount_paid = f.paid,
    amount_remaining = GREATEST(COALESCE(f.total_amount,0) - f.paid, 0),
    status = CASE
      WHEN f.paid <= 0 THEN 'sent'
      WHEN GREATEST(COALESCE(f.total_amount,0) - f.paid, 0) <= 0.01 THEN 'paid'
      ELSE 'partial' END,
    updated_at = now()
FROM final f
WHERE f.id = i.id
  AND (i.amount_paid IS DISTINCT FROM f.paid
       OR i.amount_remaining IS DISTINCT FROM GREATEST(COALESCE(f.total_amount,0) - f.paid, 0));