
-- Add 'addon' to allowed line types
ALTER TABLE public.booking_margin_lines 
DROP CONSTRAINT booking_margin_lines_line_type_check;

ALTER TABLE public.booking_margin_lines
ADD CONSTRAINT booking_margin_lines_line_type_check
CHECK (line_type = ANY (ARRAY['hotel','flight','transfer','cruise','insurance','service_fee','package','excursion','addon','other']));

-- Now update the beverage line
UPDATE public.booking_margin_lines 
SET description = 'CHEERS! Drink Package',
    unit_cost = 335.76,
    unit_sell = 335.76,
    is_pass_through = true,
    line_type = 'addon',
    updated_at = now()
WHERE id = '3e71b7d6-f152-49b6-84f1-880b2b2679a1';

-- Update wifi line
UPDATE public.booking_margin_lines 
SET description = 'Value Wi-Fi Package',
    unit_sell = 68.00,
    is_pass_through = true,
    line_type = 'addon',
    updated_at = now()
WHERE id = '57c68008-35e7-4b61-97b5-a6f9cf1719ed';
