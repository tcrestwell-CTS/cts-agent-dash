ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS ensemble_sync_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ensemble_account_ref text,
  ADD COLUMN IF NOT EXISTS ensemble_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS ensemble_last_sync_status text;