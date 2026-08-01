ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS consortium_name text,
  ADD COLUMN IF NOT EXISTS consortium_member_id text,
  ADD COLUMN IF NOT EXISTS consortium_joined_on date;

UPDATE public.agency_settings SET consortium_name = 'Ensemble Travel Group' WHERE consortium_name IS NULL;