ALTER TABLE public.trip_cabin_options
  ADD COLUMN IF NOT EXISTS requires_double_occupancy boolean NOT NULL DEFAULT false;