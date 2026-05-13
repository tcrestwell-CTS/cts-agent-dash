-- Promote clients from 'lead' to 'active' when a trip enters confirmed/booked/completed.
-- One-way: never auto-demote.

CREATE OR REPLACE FUNCTION public.promote_client_on_trip_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients
     SET status = 'active'
   WHERE id = NEW.client_id
     AND status = 'lead';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_client_on_trip_status ON public.trips;

CREATE TRIGGER trg_promote_client_on_trip_status
AFTER INSERT OR UPDATE OF status ON public.trips
FOR EACH ROW
WHEN (
  NEW.client_id IS NOT NULL
  AND NEW.status IN ('confirmed', 'booked', 'completed')
)
EXECUTE FUNCTION public.promote_client_on_trip_status();

-- One-time backfill
UPDATE public.clients c
   SET status = 'active'
 WHERE c.status = 'lead'
   AND EXISTS (
     SELECT 1 FROM public.trips t
      WHERE t.client_id = c.id
        AND t.status IN ('confirmed', 'booked', 'completed')
   );
