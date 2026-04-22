
-- Add deposit_amount and is_optional to booking_margin_lines for itemized package pricing
ALTER TABLE public.booking_margin_lines
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false;

-- Add item_price to itinerary_items for option block pricing
ALTER TABLE public.itinerary_items
  ADD COLUMN IF NOT EXISTS item_price numeric DEFAULT NULL;
