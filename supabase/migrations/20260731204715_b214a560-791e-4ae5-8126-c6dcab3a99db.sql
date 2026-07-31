ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS passport_number text,
  ADD COLUMN IF NOT EXISTS passport_full_name text,
  ADD COLUMN IF NOT EXISTS passport_nationality text,
  ADD COLUMN IF NOT EXISTS passport_issuing_country text,
  ADD COLUMN IF NOT EXISTS passport_date_of_birth date,
  ADD COLUMN IF NOT EXISTS passport_sex text,
  ADD COLUMN IF NOT EXISTS passport_expiry date;

CREATE INDEX IF NOT EXISTS idx_clients_passport_expiry
  ON public.clients (passport_expiry)
  WHERE passport_expiry IS NOT NULL;