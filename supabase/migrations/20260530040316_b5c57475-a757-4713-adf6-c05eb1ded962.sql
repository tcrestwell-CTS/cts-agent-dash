ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'lead'::text, 'inactive'::text, 'blacklisted'::text]));