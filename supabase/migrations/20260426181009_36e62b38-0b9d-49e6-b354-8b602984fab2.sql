-- Add linked_client_id to traveler/companion tables for unifying with clients
ALTER TABLE public.client_companions
  ADD COLUMN IF NOT EXISTS linked_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.trip_travelers
  ADD COLUMN IF NOT EXISTS linked_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.booking_travelers
  ADD COLUMN IF NOT EXISTS linked_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_companions_linked_client_id ON public.client_companions(linked_client_id);
CREATE INDEX IF NOT EXISTS idx_trip_travelers_linked_client_id ON public.trip_travelers(linked_client_id);
CREATE INDEX IF NOT EXISTS idx_booking_travelers_linked_client_id ON public.booking_travelers(linked_client_id);

-- Backfill: match by user_id + lowercased email first
UPDATE public.client_companions cc
SET linked_client_id = c.id
FROM public.clients c
WHERE cc.linked_client_id IS NULL
  AND cc.email IS NOT NULL
  AND c.email IS NOT NULL
  AND lower(trim(cc.email)) = lower(trim(c.email))
  AND cc.user_id = c.user_id;

UPDATE public.trip_travelers tt
SET linked_client_id = c.id
FROM public.clients c
WHERE tt.linked_client_id IS NULL
  AND tt.email IS NOT NULL
  AND c.email IS NOT NULL
  AND lower(trim(tt.email)) = lower(trim(c.email))
  AND tt.user_id = c.user_id;

-- Then by user_id + first_name + last_name (case-insensitive)
UPDATE public.client_companions cc
SET linked_client_id = c.id
FROM public.clients c
WHERE cc.linked_client_id IS NULL
  AND cc.first_name IS NOT NULL
  AND lower(trim(cc.first_name)) = lower(trim(coalesce(c.first_name, split_part(c.name, ' ', 1))))
  AND lower(trim(coalesce(cc.last_name, ''))) = lower(trim(coalesce(c.last_name, split_part(c.name, ' ', 2), '')))
  AND cc.user_id = c.user_id;

UPDATE public.trip_travelers tt
SET linked_client_id = c.id
FROM public.clients c
WHERE tt.linked_client_id IS NULL
  AND tt.first_name IS NOT NULL
  AND lower(trim(tt.first_name)) = lower(trim(coalesce(c.first_name, split_part(c.name, ' ', 1))))
  AND lower(trim(coalesce(tt.last_name, ''))) = lower(trim(coalesce(c.last_name, split_part(c.name, ' ', 2), '')))
  AND tt.user_id = c.user_id;

-- For unmatched rows that have an email, create new client records
INSERT INTO public.clients (user_id, name, first_name, last_name, email, phone, status, source, birthday, known_traveler_number, passport_info)
SELECT DISTINCT ON (cc.user_id, lower(trim(cc.email)))
  cc.user_id,
  trim(coalesce(cc.first_name, '') || ' ' || coalesce(cc.last_name, '')) AS name,
  cc.first_name,
  cc.last_name,
  cc.email,
  cc.phone,
  'active',
  'companion_migration',
  cc.birthday,
  cc.known_traveler_number,
  cc.passport_info
FROM public.client_companions cc
WHERE cc.linked_client_id IS NULL
  AND cc.email IS NOT NULL
  AND trim(cc.email) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.clients c2
    WHERE c2.user_id = cc.user_id
      AND lower(trim(c2.email)) = lower(trim(cc.email))
  )
ORDER BY cc.user_id, lower(trim(cc.email)), cc.created_at;

-- Re-run match by email after inserts
UPDATE public.client_companions cc
SET linked_client_id = c.id
FROM public.clients c
WHERE cc.linked_client_id IS NULL
  AND cc.email IS NOT NULL
  AND c.email IS NOT NULL
  AND lower(trim(cc.email)) = lower(trim(c.email))
  AND cc.user_id = c.user_id;

-- Same for trip_travelers — create clients for those with email
INSERT INTO public.clients (user_id, name, first_name, last_name, email, phone, status, source, birthday, known_traveler_number, passport_info)
SELECT DISTINCT ON (tt.user_id, lower(trim(tt.email)))
  tt.user_id,
  trim(coalesce(tt.first_name, '') || ' ' || coalesce(tt.last_name, '')) AS name,
  tt.first_name,
  tt.last_name,
  tt.email,
  tt.phone,
  'active',
  'traveler_migration',
  CASE WHEN tt.birthday ~ '^\d{4}-\d{2}-\d{2}$' THEN tt.birthday::date ELSE NULL END,
  tt.known_traveler_number,
  tt.passport_info
FROM public.trip_travelers tt
WHERE tt.linked_client_id IS NULL
  AND tt.email IS NOT NULL
  AND trim(tt.email) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.clients c2
    WHERE c2.user_id = tt.user_id
      AND lower(trim(c2.email)) = lower(trim(tt.email))
  )
ORDER BY tt.user_id, lower(trim(tt.email)), tt.created_at;

UPDATE public.trip_travelers tt
SET linked_client_id = c.id
FROM public.clients c
WHERE tt.linked_client_id IS NULL
  AND tt.email IS NOT NULL
  AND c.email IS NOT NULL
  AND lower(trim(tt.email)) = lower(trim(c.email))
  AND tt.user_id = c.user_id;

-- booking_travelers already references companion_id which now points to companions that have linked_client_id
-- Backfill booking_travelers.linked_client_id from its companion's linked_client_id
UPDATE public.booking_travelers bt
SET linked_client_id = cc.linked_client_id
FROM public.client_companions cc
WHERE bt.linked_client_id IS NULL
  AND bt.companion_id = cc.id
  AND cc.linked_client_id IS NOT NULL;