
CREATE OR REPLACE FUNCTION public.expire_cc_auth_on_paid_in_full()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking_id uuid;
  v_gross numeric;
  v_paid numeric;
BEGIN
  v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);
  IF v_booking_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(gross_sales, 0) INTO v_gross
  FROM public.bookings WHERE id = v_booking_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.trip_payments
  WHERE booking_id = v_booking_id AND status = 'paid';

  IF v_gross > 0 AND v_paid >= (v_gross - 0.01) THEN
    UPDATE public.cc_authorizations
    SET status = 'expired', updated_at = now()
    WHERE booking_id = v_booking_id
      AND status IN ('pending', 'authorized');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_expire_cc_auth_on_paid ON public.trip_payments;
CREATE TRIGGER trg_expire_cc_auth_on_paid
AFTER INSERT OR UPDATE OF status, amount ON public.trip_payments
FOR EACH ROW
EXECUTE FUNCTION public.expire_cc_auth_on_paid_in_full();
