UPDATE public.trip_payments
SET payment_method = 'credit_card', payment_date = COALESCE(due_date, payment_date)
WHERE trip_id = '378ec725-3b6f-4f55-bf14-b2bd4e2066d7'
  AND status = 'paid'
  AND payment_method IS NULL;