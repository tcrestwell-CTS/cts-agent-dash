ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS trip_subtype text;
COMMENT ON COLUMN public.trips.trip_subtype IS 'Trip category: lodging | all_inclusive | cruise | flight | transportation';
UPDATE public.trips SET trip_subtype = trip_type WHERE trip_subtype IS NULL AND trip_type IN ('lodging','all_inclusive','cruise','flight','transportation');