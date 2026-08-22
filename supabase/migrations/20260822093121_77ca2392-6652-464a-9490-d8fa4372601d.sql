UPDATE public.booking_payer_shares SET share_amount = 775.56, updated_at = now()
 WHERE trip_id = '699bbcf2-9f03-4762-b75b-cc4380f5eaa5';

UPDATE public.trip_payments SET amount = 100, payer_name = 'Jennifer Dawkins', payer_email = 'jdawkins68@gmail.com',
  details = 'Deposit for approved itinerary — Jennifer Dawkins share'
 WHERE id = '24fe42a0-e010-4956-b2c1-3c6e82068993';

INSERT INTO public.trip_payments (user_id, trip_id, booking_id, amount, payment_date, due_date, payment_type, status, details, payer_traveler_id, payer_name, payer_email)
SELECT user_id, trip_id, booking_id, 100, payment_date, due_date, payment_type, status,
  'Deposit for approved itinerary — Donna Williams-Smith share',
  'e9ce1fea-d8cc-492d-94de-8313aab09a1f', 'Donna Williams-Smith', 'chefdmwsmith@gmail.com'
FROM public.trip_payments WHERE id = '24fe42a0-e010-4956-b2c1-3c6e82068993';

UPDATE public.trip_payments SET payer_name = 'Jennifer Dawkins', payer_email = 'jdawkins68@gmail.com'
 WHERE id IN ('bd282d72-b650-486d-a78e-552c5938b491','0cdc8781-b55b-408a-a627-e38a2d132ba4','d24c5374-dd6a-41d9-b8cf-dbcb6ef84678');