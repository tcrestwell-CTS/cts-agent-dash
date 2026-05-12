CREATE OR REPLACE FUNCTION public.is_invoice_cash_payment(p trip_payments)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.status = 'paid' AND p.payment_date IS NOT NULL;
$function$;

-- Re-sync every invoice's amount_paid / amount_remaining / status
WITH paid AS (
  SELECT i.id AS invoice_id,
         i.total_amount,
         COALESCE(SUM(tp.amount) FILTER (WHERE public.is_invoice_cash_payment(tp.*)), 0) AS sum_paid
  FROM public.invoices i
  LEFT JOIN public.trip_payments tp ON tp.trip_id = i.trip_id
  GROUP BY i.id, i.total_amount
)
UPDATE public.invoices i
SET amount_paid = paid.sum_paid,
    amount_remaining = GREATEST(COALESCE(i.total_amount,0) - paid.sum_paid, 0),
    status = CASE
      WHEN paid.sum_paid <= 0 THEN 'sent'
      WHEN COALESCE(i.total_amount,0) - paid.sum_paid <= 0.01 THEN 'paid'
      ELSE 'partial'
    END,
    updated_at = now()
FROM paid
WHERE paid.invoice_id = i.id;