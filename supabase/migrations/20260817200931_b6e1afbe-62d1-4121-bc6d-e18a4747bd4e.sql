ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS legal_first_name text,
ADD COLUMN IF NOT EXISTS legal_last_name text;