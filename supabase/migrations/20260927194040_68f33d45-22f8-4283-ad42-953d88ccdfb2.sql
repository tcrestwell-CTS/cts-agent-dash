CREATE OR REPLACE FUNCTION public.cancel_pending_payments_on_trip_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.trip_payments SET status = 'cancelled'
    WHERE trip_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_cancel_pending_payments_on_trip_cancel ON public.trips;
CREATE TRIGGER trg_cancel_pending_payments_on_trip_cancel
AFTER UPDATE OF status ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.cancel_pending_payments_on_trip_cancel();
UPDATE public.trip_payments tp SET status = 'cancelled'
FROM public.trips t WHERE t.id = tp.trip_id AND t.status = 'cancelled' AND tp.status = 'pending';