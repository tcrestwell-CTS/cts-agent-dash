DO $$
DECLARE v_trip uuid := '50643e54-cb13-46ad-a6f2-744b395200d4'; v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.trip_payments WHERE trip_id = v_trip LIMIT 1;

  INSERT INTO public.trip_payments (trip_id, user_id, amount, payment_date, payment_type, payment_method, status, details)
  VALUES
    (v_trip, v_user, 278.60, '2026-09-03', 'payment', 'credit_card', 'paid', 'Web credit card payment (supplier trans #6324151)'),
    (v_trip, v_user, 939.08, '2026-09-09', 'final', 'apple_pay', 'paid', 'Final balance paid via Apple Pay (supplier trans #6354843)');

  UPDATE public.trip_payments
     SET status = 'cancelled',
         details = COALESCE(details, '') || ' - superseded by final payment 09/09/26'
   WHERE trip_id = v_trip AND status = 'pending';
END $$;