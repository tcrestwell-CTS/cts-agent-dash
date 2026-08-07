ALTER TABLE public.itinerary_items
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS confirmation_number text,
  ADD COLUMN IF NOT EXISTS booking_status text,
  ADD COLUMN IF NOT EXISTS supplier_cost numeric,
  ADD COLUMN IF NOT EXISTS commission_amount numeric;