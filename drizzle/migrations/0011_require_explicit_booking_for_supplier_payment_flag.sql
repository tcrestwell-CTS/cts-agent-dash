CREATE OR REPLACE FUNCTION public.trigger_qbo_supplier_paid_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.bookings%ROWTYPE;
  next_amount numeric;
BEGIN
  IF NEW.supplier_paid_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.supplier_paid_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.booking_id IS NULL THEN
    RAISE EXCEPTION 'Link this payment to the correct supplier booking before marking it paid.';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = NEW.booking_id AND trip_id = NEW.trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The linked supplier booking does not belong to this trip.'; END IF;
  IF NEW.status <> 'paid' OR COALESCE(NEW.amount, 0) <= 0 THEN
    RAISE EXCEPTION 'A supplier payment requires a paid client payment with a positive amount.';
  END IF;
  IF COALESCE(b.supplier_payout, 0) <= 0 THEN
    RAISE EXCEPTION 'Set the booking supplier cost before recording a supplier payment.';
  END IF;
  next_amount := ROUND(COALESCE(b.supplier_paid_amount, 0) + NEW.amount, 2);
  IF b.supplier_paid_status = 'paid' OR next_amount > ROUND(b.supplier_payout, 2) THEN
    RAISE EXCEPTION 'This payment exceeds the remaining supplier balance; record the correct amount on the booking.';
  END IF;
  UPDATE public.bookings
  SET supplier_paid_status = CASE WHEN next_amount >= ROUND(b.supplier_payout, 2) THEN 'paid' ELSE 'partial' END,
      supplier_paid_amount = next_amount,
      supplier_paid_date = CURRENT_DATE,
      supplier_paid_method = COALESCE(NEW.supplier_payment_method, 'other'),
      supplier_paid_reference = NEW.supplier_payment_ref
  WHERE id = b.id;
  RETURN NEW;
END;
$$;