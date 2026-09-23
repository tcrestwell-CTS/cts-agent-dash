-- 1. Running balance columns on trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS total_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_scheduled numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due numeric NOT NULL DEFAULT 0;

-- 2. Recalculate a single trip's payment rollup
CREATE OR REPLACE FUNCTION public.recalc_trip_payment_rollup(p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_paid numeric := 0;
  v_scheduled numeric := 0;
  v_total numeric := 0;
BEGIN
  IF p_trip_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status IN ('pending','authorized','scheduled') THEN amount ELSE 0 END), 0)
  INTO v_paid, v_scheduled
  FROM public.trip_payments
  WHERE trip_id = p_trip_id;

  SELECT COALESCE(total_gross_sales, 0) INTO v_total FROM public.trips WHERE id = p_trip_id;

  UPDATE public.trips SET
    total_paid = ROUND(v_paid, 2),
    total_scheduled = ROUND(v_scheduled, 2),
    balance_due = GREATEST(0, ROUND(v_total - v_paid, 2))
  WHERE id = p_trip_id
    AND (total_paid IS DISTINCT FROM ROUND(v_paid, 2)
      OR total_scheduled IS DISTINCT FROM ROUND(v_scheduled, 2)
      OR balance_due IS DISTINCT FROM GREATEST(0, ROUND(v_total - v_paid, 2)));
END;
$fn$;

-- 3. Trigger: payments changed -> refresh that trip's balance
CREATE OR REPLACE FUNCTION public.trg_recalc_trip_payment_rollup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM public.recalc_trip_payment_rollup(NEW.trip_id);
  IF TG_OP = 'UPDATE' AND OLD.trip_id IS DISTINCT FROM NEW.trip_id THEN
    PERFORM public.recalc_trip_payment_rollup(OLD.trip_id);
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trg_recalc_trip_payment_rollup_del()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM public.recalc_trip_payment_rollup(OLD.trip_id);
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_payments_rollup_ins_upd ON public.trip_payments;
CREATE TRIGGER trg_payments_rollup_ins_upd
AFTER INSERT OR UPDATE OF amount, status, trip_id ON public.trip_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_trip_payment_rollup();

DROP TRIGGER IF EXISTS trg_payments_rollup_del ON public.trip_payments;
CREATE TRIGGER trg_payments_rollup_del
AFTER DELETE ON public.trip_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_trip_payment_rollup_del();

-- 4. Trigger: trip total changed -> refresh balance due
CREATE OR REPLACE FUNCTION public.trg_recalc_trip_balance_on_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM public.recalc_trip_payment_rollup(NEW.id);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_trip_balance_on_total ON public.trips;
CREATE TRIGGER trg_trip_balance_on_total
AFTER UPDATE OF total_gross_sales ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_trip_balance_on_total();

-- 5. Trigger: itemized pricing lines changed -> recalc the booking (cascades to trip totals)
CREATE OR REPLACE FUNCTION public.trg_recalc_booking_from_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_booking_id uuid;
BEGIN
  v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);
  IF v_booking_id IS NOT NULL THEN
    PERFORM public.calculate_booking_margin(v_booking_id, NULL, false);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS trg_booking_lines_recalc ON public.booking_margin_lines;
CREATE TRIGGER trg_booking_lines_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.booking_margin_lines
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_booking_from_lines();

-- 6. Integrity audit
CREATE OR REPLACE FUNCTION public.audit_account_integrity()
RETURNS TABLE (
  scope text,
  record_id uuid,
  label text,
  field text,
  stored_value numeric,
  expected_value numeric,
  difference numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  -- Booking gross vs sum of its itemized lines
  SELECT 'booking'::text, b.id, COALESCE(b.confirmation_number, b.id::text),
         'gross_sales'::text, COALESCE(b.gross_sales,0), l.sell,
         ROUND(COALESCE(b.gross_sales,0) - l.sell, 2)
  FROM public.bookings b
  JOIN (SELECT booking_id, ROUND(SUM(total_sell),2) sell FROM public.booking_margin_lines GROUP BY booking_id) l
    ON l.booking_id = b.id
  WHERE COALESCE(b.margin_locked,false) = false
    AND ROUND(COALESCE(b.gross_sales,0),2) <> l.sell

  UNION ALL
  -- Trip total vs sum of its bookings
  SELECT 'trip'::text, t.id, t.trip_name, 'total_gross_sales'::text,
         COALESCE(t.total_gross_sales,0), s.gross,
         ROUND(COALESCE(t.total_gross_sales,0) - s.gross, 2)
  FROM public.trips t
  JOIN (SELECT trip_id, ROUND(SUM(COALESCE(gross_sales,0)),2) gross FROM public.bookings WHERE trip_id IS NOT NULL GROUP BY trip_id) s
    ON s.trip_id = t.id
  WHERE ROUND(COALESCE(t.total_gross_sales,0),2) <> s.gross

  UNION ALL
  -- Trip paid vs sum of paid payments
  SELECT 'trip'::text, t.id, t.trip_name, 'total_paid'::text,
         COALESCE(t.total_paid,0), p.paid,
         ROUND(COALESCE(t.total_paid,0) - p.paid, 2)
  FROM public.trips t
  JOIN (SELECT trip_id, ROUND(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),2) paid
        FROM public.trip_payments WHERE trip_id IS NOT NULL GROUP BY trip_id) p
    ON p.trip_id = t.id
  WHERE ROUND(COALESCE(t.total_paid,0),2) <> p.paid;
$fn$;

-- 7. Repair: recalc every booking with lines, then every trip rollup
CREATE OR REPLACE FUNCTION public.repair_account_integrity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r RECORD;
  v_bookings integer := 0;
  v_trips integer := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR r IN SELECT DISTINCT b.id FROM public.bookings b
           JOIN public.booking_margin_lines l ON l.booking_id = b.id
           WHERE COALESCE(b.margin_locked,false) = false
  LOOP
    PERFORM public.calculate_booking_margin(r.id, NULL, false);
    v_bookings := v_bookings + 1;
  END LOOP;

  FOR r IN SELECT id FROM public.trips LOOP
    PERFORM public.recalc_trip_payment_rollup(r.id);
    v_trips := v_trips + 1;
  END LOOP;

  RETURN jsonb_build_object('bookings_recalculated', v_bookings, 'trips_recalculated', v_trips);
END;
$fn$;

REVOKE ALL ON FUNCTION public.audit_account_integrity() FROM anon;
REVOKE ALL ON FUNCTION public.repair_account_integrity() FROM anon;
GRANT EXECUTE ON FUNCTION public.audit_account_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_account_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_trip_payment_rollup(uuid) TO authenticated;

-- 8. Backfill existing trips
DO $do$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.trips LOOP
    PERFORM public.recalc_trip_payment_rollup(r.id);
  END LOOP;
END;
$do$;