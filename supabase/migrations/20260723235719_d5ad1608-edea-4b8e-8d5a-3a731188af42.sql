DO $$ BEGIN
  CREATE TYPE public.client_tier AS ENUM ('explorer', 'voyager', 'platinum', 'elite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS membership_tier public.client_tier NOT NULL DEFAULT 'explorer';

CREATE INDEX IF NOT EXISTS idx_clients_membership_tier ON public.clients(membership_tier);