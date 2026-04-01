
-- Delete the synthetic line that's double-counting
DELETE FROM public.booking_margin_lines 
WHERE id = 'bf469330-5c4f-4d91-a291-0e061f288763';

-- Update base fare line: correct description and sell price
UPDATE public.booking_margin_lines 
SET description = 'Net Cruise Fare',
    unit_sell = 2568.00,
    line_type = 'cruise',
    updated_at = now()
WHERE id = '72160f47-ac05-4db2-977b-605aec044ef6';
