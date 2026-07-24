
UPDATE public.loan_payment_schedules
SET status = 'paid',
    paid_date = '2026-07-17'::timestamptz,
    stripe_payment_intent_id = 'pi_3TuMjhPJljF0WNcY1FmOymkH',
    updated_at = now()
WHERE id = 'f9a35f4c-4ba3-4b82-b8cf-88b75f20fbd9';

UPDATE public.exception_queue
SET status = 'resolved',
    resolved_at = now(),
    resolution_notes = 'Applied to Gerri Cannon loan payment #3 (2026-06-19). Stripe PI: pi_3TuMjhPJljF0WNcY1FmOymkH'
WHERE id = '9cb2f21d-4462-4faf-9b4d-f5a21d30f6c5';
