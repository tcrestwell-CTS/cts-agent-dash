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
      AND (
        p.payment_type IN ('installment', 'final', 'final_balance')
        OR COALESCE(p.details, '') ILIKE 'installment%'
        OR COALESCE(p.details, '') ILIKE 'final balance%'
      )
    );
$$;

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