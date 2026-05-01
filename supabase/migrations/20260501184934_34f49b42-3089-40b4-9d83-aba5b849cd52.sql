
ALTER TABLE public.qbo_connections
  ADD COLUMN IF NOT EXISTS default_bank_account_id text,
  ADD COLUMN IF NOT EXISTS default_bank_account_name text,
  ADD COLUMN IF NOT EXISTS default_cc_account_id text,
  ADD COLUMN IF NOT EXISTS default_cc_account_name text;
