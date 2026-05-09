
UPDATE booking_margin_lines SET unit_sell=2824, unit_cost=2372.16,
  description='Cruise fare (commissionable) - Virgin Voyages'
WHERE id='7ae8d2d8-9cf8-494b-8c30-a1165c570b78';

UPDATE booking_margin_lines SET unit_sell=434, unit_cost=434
WHERE id='e46b1bff-f5ed-4780-8d0b-b6706f705c1f';

SELECT calculate_booking_margin('26bf4036-7527-47eb-bdfc-17ca5f5873a4', NULL, true);

UPDATE trip_payments SET payment_method='credit_card'
WHERE trip_id='782a7f90-fe4b-453f-9687-21594ca5dc11' AND status='paid' AND payment_method IS NULL;
