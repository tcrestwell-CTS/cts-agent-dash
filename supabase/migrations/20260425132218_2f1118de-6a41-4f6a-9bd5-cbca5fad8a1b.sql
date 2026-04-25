-- Enforce one invoice per (user, trip) to prevent duplicates from idempotent re-runs.
-- Partial unique index: only applies when trip_id is set (allows non-trip invoices and historical NULLs).
-- First, dedupe any existing rows that would violate the constraint by keeping the oldest per (user_id, trip_id).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, trip_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.invoices
  WHERE trip_id IS NOT NULL
)
DELETE FROM public.invoices i
USING ranked r
WHERE i.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_trip_unique
  ON public.invoices (user_id, trip_id)
  WHERE trip_id IS NOT NULL;