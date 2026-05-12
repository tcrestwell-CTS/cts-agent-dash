UPDATE public.trip_payments
SET status = 'paid', updated_at = now()
WHERE status != 'paid'
  AND payment_date IS NOT NULL
  AND payment_date <= CURRENT_DATE;