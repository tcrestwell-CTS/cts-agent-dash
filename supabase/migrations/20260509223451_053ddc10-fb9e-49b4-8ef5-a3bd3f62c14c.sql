
UPDATE booking_margin_lines SET unit_sell=2352, unit_cost=1975.68,
  description='Cruise fare (commissionable) - Virgin Voyages'
WHERE id='52ba2939-f018-4d10-b09a-ed6d811776ca';

UPDATE booking_margin_lines SET unit_sell=217, unit_cost=217
WHERE id='371303b4-39bf-4280-b6b6-724d954999e7';

UPDATE bookings SET confirmation_number='2469055' WHERE id='d128ab2a-bdb1-4f0b-8860-74e77d5393f1';

SELECT calculate_booking_margin('d128ab2a-bdb1-4f0b-8860-74e77d5393f1', NULL, true);

UPDATE trip_payments SET payment_method='credit_card'
WHERE trip_id='52d9a17b-1ab0-474a-82c5-895f033d1820' AND status='paid' AND payment_method IS NULL;
