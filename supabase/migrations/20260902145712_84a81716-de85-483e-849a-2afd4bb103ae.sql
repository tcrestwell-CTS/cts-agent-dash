CREATE OR REPLACE FUNCTION public.is_invoice_cash_payment(p trip_payments)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.status = 'paid'
     AND p.payment_date IS NOT NULL
     AND NOT (
       p.due_date IS NOT NULL
       AND p.payment_method IS NULL
       AND p.stripe_session_id IS NULL
       AND p.stripe_receipt_url IS NULL
       AND (
         p.payment_type IN ('installment','final','final_balance')
         OR lower(coalesce(p.details,'')) LIKE 'installment%'
         OR lower(coalesce(p.details,'')) LIKE 'final balance%'
       )
     );
$function$;

WITH agg AS (
  SELECT i.id,
         COALESCE(i.total_amount, 0) AS total,
         COALESCE((
           SELECT SUM(p.amount) FROM public.trip_payments p
           WHERE p.trip_id = i.trip_id AND public.is_invoice_cash_payment(p)
         ), 0) AS paid
  FROM public.invoices i
  WHERE i.trip_id IS NOT NULL
)
UPDATE public.invoices i
SET amount_paid = agg.paid,
    amount_remaining = GREATEST(agg.total - agg.paid, 0),
    status = CASE
      WHEN agg.paid <= 0 THEN 'sent'
      WHEN GREATEST(agg.total - agg.paid, 0) <= 0.01 THEN 'paid'
      ELSE 'partial'
    END,
    updated_at = now()
FROM agg
WHERE i.id = agg.id
  AND (i.amount_paid IS DISTINCT FROM agg.paid
       OR i.amount_remaining IS DISTINCT FROM GREATEST(agg.total - agg.paid, 0));