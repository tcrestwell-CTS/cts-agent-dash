ALTER TABLE public.msc_fares
  ADD COLUMN IF NOT EXISTS fare_description text,
  ADD COLUMN IF NOT EXISTS cruise_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS now_available boolean NOT NULL DEFAULT false;

ALTER TABLE public.msc_items
  ADD COLUMN IF NOT EXISTS package_code text,
  ADD COLUMN IF NOT EXISTS pax_applicability text;

CREATE INDEX IF NOT EXISTS msc_fares_bookable_idx
  ON public.msc_fares (cruise_id, fare_code)
  WHERE cruise_only AND now_available;