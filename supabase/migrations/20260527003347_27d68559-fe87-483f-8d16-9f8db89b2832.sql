ALTER TABLE public.trip_cabin_options
ADD COLUMN IF NOT EXISTS price_period text NOT NULL DEFAULT 'trip'
CHECK (price_period IN ('trip','night'));