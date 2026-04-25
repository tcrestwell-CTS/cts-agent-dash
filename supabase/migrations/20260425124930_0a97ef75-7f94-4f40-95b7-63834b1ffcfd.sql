ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'native';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'native';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'native';

CREATE INDEX IF NOT EXISTS idx_trips_source ON public.trips(source);
CREATE INDEX IF NOT EXISTS idx_bookings_source ON public.bookings(source);
CREATE INDEX IF NOT EXISTS idx_clients_source ON public.clients(source);