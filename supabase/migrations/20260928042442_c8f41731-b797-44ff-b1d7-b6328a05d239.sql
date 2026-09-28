CREATE OR REPLACE FUNCTION public.trg_recalc_booking_from_lines()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_booking_id uuid;
BEGIN
  v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);
  IF v_booking_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bookings WHERE id = v_booking_id) THEN
    PERFORM public.calculate_booking_margin(v_booking_id, NULL, false);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;