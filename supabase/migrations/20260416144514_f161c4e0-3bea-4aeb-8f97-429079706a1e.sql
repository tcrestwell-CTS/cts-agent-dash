ALTER TABLE public.flight_orders ADD COLUMN IF NOT EXISTS eticket_numbers text[] DEFAULT '{}';
ALTER TABLE public.flight_orders ADD COLUMN IF NOT EXISTS eticket_data jsonb DEFAULT '[]'::jsonb;