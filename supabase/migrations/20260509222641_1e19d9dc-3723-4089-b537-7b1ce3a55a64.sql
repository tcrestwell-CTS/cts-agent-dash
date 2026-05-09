
UPDATE booking_margin_lines
SET unit_sell=2824, unit_cost=2372.16,
    description='Cruise fare (commissionable) - Virgin Voyages'
WHERE id='a2ad5194-5d80-420e-aa05-760225a5aa4d';

UPDATE booking_margin_lines
SET unit_sell=434, unit_cost=434,
    description='Taxes, port fees & non-commissionable charges (pass-through)'
WHERE id='82b8cb73-bbfe-4c06-8687-8fe4158d03ae';

SELECT calculate_booking_margin('25b6ba5b-2324-4f57-b803-98b8ce4c45d3', NULL, true);

UPDATE trip_payments
SET status='pending', payment_method=NULL
WHERE id='b6612e96-734e-4937-abf0-9fbab7e38158';

UPDATE trip_payments SET payment_method='credit_card'
WHERE id='963b40c7-ad00-483b-bee2-acbe9ea251ac' AND payment_method IS NULL;
