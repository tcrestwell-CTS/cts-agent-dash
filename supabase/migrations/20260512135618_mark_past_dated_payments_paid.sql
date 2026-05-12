-- Trip payments with a past payment_date but stale 'unpaid'/'pending' status
-- were causing false overdue reminders. Mark them paid.
UPDATE public.trip_payments
SET status = 'paid', updated_at = now()
WHERE status != 'paid'
  AND payment_date IS NOT NULL
  AND payment_date <= CURRENT_DATE;
