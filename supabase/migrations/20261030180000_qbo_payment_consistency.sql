-- Client-receipt, refund, supplier-bill, and trip-balance consistency.
-- Does not update QuickBooks. Does not rewrite trip_payments rows.
-- Recalculates trips.total_paid / balance_due from real receipts only.
-- Invoice amount_paid is corrected the next time a payment on that trip changes
-- (a bulk invoice update would fan out to the Kandi webhook).

ALTER TABLE public.trip_payments
  ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.is_invoice_cash_payment(p public.trip_payments)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.status = 'paid'
    AND p.payment_date IS NOT NULL
    AND COALESCE(p.amount, 0) - COALESCE(p.refunded_amount, 0) > 0
    AND NOT (
      p.due_date IS NOT NULL
      AND (p.payment_method IS NULL OR btrim(p.payment_method) = '' OR lower(btrim(p.payment_method)) = 'none')
      AND p.stripe_session_id IS NULL
      AND p.stripe_receipt_url IS NULL
      AND p.stripe_payment_intent_id IS NULL
      AND COALESCE(p.details, '') !~* '\m(cash|check|cheque|zelle|venmo|wire|ach|paypal|cashapp)\M'
      AND COALESCE(p.notes, '') !~* '\m(cash|check|cheque|zelle|venmo|wire|ach|paypal|cashapp)\M'
      AND COALESCE(p.details, '') !~* 'money[[:space:]]+order|bank[[:space:]]+transfer|cash[[:space:]]+app'
      AND COALESCE(p.notes, '') !~* 'money[[:space:]]+order|bank[[:space:]]+transfer|cash[[:space:]]+app'
      AND (
        p.payment_type IN ('installment', 'final')
        OR COALESCE(p.details, '') ~* '^installment[[:space:]]+[0-9]'
        OR COALESCE(p.details, '') ~* '^final balance[[:space:]]*(\(|$)'
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.invoice_cash_amount(p public.trip_payments)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.is_invoice_cash_payment(p)
    THEN GREATEST(COALESCE(p.amount, 0) - COALESCE(p.refunded_amount, 0), 0)
    ELSE 0
  END;
$$;

-- Cash received is the receipt net of refunds. Covered schedule rows
-- (status applied, or paid with no tender) are not added again.
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
    COALESCE(SUM(public.invoice_cash_amount(tp)), 0),
    COALESCE(SUM(CASE WHEN tp.status IN ('pending', 'authorized', 'scheduled') THEN tp.amount ELSE 0 END), 0)
  INTO v_paid, v_scheduled
  FROM public.trip_payments tp
  WHERE tp.trip_id = p_trip_id;

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

DROP TRIGGER IF EXISTS trg_payments_rollup_ins_upd ON public.trip_payments;
CREATE TRIGGER trg_payments_rollup_ins_upd
AFTER INSERT OR UPDATE OF amount, status, trip_id, refunded_amount, payment_method, payment_date, due_date, details, notes, stripe_session_id, stripe_receipt_url, stripe_payment_intent_id
ON public.trip_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_trip_payment_rollup();

-- Invoice paid amount follows the same cash rule. Do not treat every
-- status=paid row as money; that counted a receipt and its covered installments twice.
CREATE OR REPLACE FUNCTION public.sync_invoice_from_trip_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trip_id uuid;
  v_paid numeric;
  v_invoice_id uuid;
  v_total numeric;
  v_remaining numeric;
  v_status text;
BEGIN
  v_trip_id := COALESCE(NEW.trip_id, OLD.trip_id);
  IF v_trip_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id, total_amount INTO v_invoice_id, v_total
  FROM public.invoices
  WHERE trip_id = v_trip_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(public.invoice_cash_amount(p)), 0) INTO v_paid
  FROM public.trip_payments p
  WHERE p.trip_id = v_trip_id;

  v_remaining := GREATEST(COALESCE(v_total, 0) - v_paid, 0);
  v_status := CASE
    WHEN v_paid <= 0 THEN 'sent'
    WHEN v_remaining <= 0.01 THEN 'paid'
    ELSE 'partial'
  END;

  UPDATE public.invoices
  SET amount_paid = v_paid,
      amount_remaining = v_remaining,
      status = v_status,
      updated_at = now()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_invoice_from_trip_payments ON public.trip_payments;
CREATE TRIGGER trg_sync_invoice_from_trip_payments
AFTER INSERT OR UPDATE OF status, amount, refunded_amount, due_date, payment_method, payment_date, stripe_session_id, stripe_receipt_url, stripe_payment_intent_id, details, notes
OR DELETE ON public.trip_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_from_trip_payments();

-- Post real receipts (including inserts). Also post a refund when a receipt
-- is marked refunded or refunded_amount increases.
CREATE OR REPLACE FUNCTION public.trigger_qbo_client_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF public.is_invoice_cash_payment(NEW) AND COALESCE(NEW.amount, 0) > 0 THEN
    IF TG_OP = 'INSERT' OR NOT public.is_invoice_cash_payment(OLD) THEN
      INSERT INTO public.agent_notifications (user_id, type, title, message, trip_id, trip_payment_id)
      VALUES (
        NEW.user_id,
        'payment_received',
        'Payment Received',
        'A payment of $' || ROUND(NEW.amount, 2)::text || ' has been marked as received.',
        NEW.trip_id,
        NEW.id
      );
      PERFORM public._post_qbo_sync_trigger(
        'client_payment_received',
        to_jsonb(NEW),
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    (NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded')
    OR COALESCE(NEW.refunded_amount, 0) > COALESCE(OLD.refunded_amount, 0) + 0.004
  ) THEN
    PERFORM public._post_qbo_sync_trigger('client_payment_refunded', to_jsonb(NEW), to_jsonb(OLD));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_trip_payment_paid ON public.trip_payments;
CREATE TRIGGER on_trip_payment_paid
  AFTER INSERT OR UPDATE ON public.trip_payments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_qbo_client_payment();

-- Partial supplier payments and amount corrections post too. A paid row whose
-- amount was left blank still qualifies when supplier_payout is present.
CREATE OR REPLACE FUNCTION public.trigger_qbo_supplier_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _trip_name text;
  _supplier_name text;
  _settled numeric;
BEGIN
  _settled := CASE
    WHEN COALESCE(NEW.supplier_paid_amount, 0) > 0 THEN NEW.supplier_paid_amount
    WHEN NEW.supplier_paid_status = 'paid' THEN COALESCE(NEW.supplier_payout, 0)
    ELSE 0
  END;

  IF NEW.supplier_paid_status IN ('paid', 'partial')
     AND _settled > 0
     AND (
       OLD.supplier_paid_status IS DISTINCT FROM NEW.supplier_paid_status
       OR COALESCE(NEW.supplier_paid_amount, 0) IS DISTINCT FROM COALESCE(OLD.supplier_paid_amount, 0)
     ) THEN
    IF NEW.supplier_paid_status = 'paid' AND OLD.supplier_paid_status IS DISTINCT FROM 'paid' THEN
      SELECT trip_name INTO _trip_name FROM public.trips WHERE id = NEW.trip_id LIMIT 1;
      SELECT name INTO _supplier_name FROM public.suppliers WHERE id = NEW.supplier_id LIMIT 1;
      INSERT INTO public.agent_notifications (user_id, type, title, message, trip_id)
      VALUES (
        NEW.user_id,
        'supplier_paid',
        'Supplier Payment Confirmed',
        'Payment of $' || ROUND(_settled, 2)::text ||
          ' to ' || COALESCE(_supplier_name, 'supplier') ||
          ' for ' || COALESCE(_trip_name, 'booking') || ' confirmed.',
        NEW.trip_id
      );
    END IF;

    PERFORM public._post_qbo_sync_trigger(
      'supplier_paid',
      to_jsonb(NEW),
      to_jsonb(OLD)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- "Mark Supplier Paid" on a client receipt settles the linked booking (payout,
-- not the client gross) so the booking trigger creates one QuickBooks bill.
CREATE OR REPLACE FUNCTION public.trigger_qbo_supplier_paid_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  b public.bookings%ROWTYPE;
BEGIN
  IF NEW.supplier_paid_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.supplier_paid_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.booking_id IS NOT NULL THEN
    SELECT * INTO b FROM public.bookings WHERE id = NEW.booking_id;
  END IF;
  IF NOT FOUND AND NEW.trip_id IS NOT NULL THEN
    SELECT * INTO b FROM public.bookings
    WHERE trip_id = NEW.trip_id
    ORDER BY created_at
    LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  -- A virtual-card charge (or an earlier partial) already settled this booking.
  IF b.supplier_paid_status IN ('paid', 'partial') OR COALESCE(b.supplier_paid_amount, 0) > 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.bookings
  SET supplier_paid_status = 'paid',
      supplier_paid_amount = CASE
        WHEN COALESCE(supplier_paid_amount, 0) > 0 THEN supplier_paid_amount
        ELSE COALESCE(supplier_payout, 0)
      END,
      supplier_paid_date = COALESCE(supplier_paid_date, CURRENT_DATE),
      supplier_paid_method = COALESCE(supplier_paid_method, NEW.supplier_payment_method, 'other')
  WHERE id = b.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qbo_supplier_paid_flag ON public.trip_payments;
CREATE TRIGGER trg_qbo_supplier_paid_flag
  AFTER INSERT OR UPDATE OF supplier_paid_at ON public.trip_payments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_qbo_supplier_paid_flag();

-- Integrity check uses the same cash definition as the rollup.
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
  SELECT 'booking'::text, b.id, COALESCE(b.confirmation_number, b.id::text),
         'gross_sales'::text, COALESCE(b.gross_sales,0), l.sell,
         ROUND(COALESCE(b.gross_sales,0) - l.sell, 2)
  FROM public.bookings b
  JOIN (SELECT booking_id, ROUND(SUM(total_sell),2) sell FROM public.booking_margin_lines GROUP BY booking_id) l
    ON l.booking_id = b.id
  WHERE COALESCE(b.margin_locked,false) = false
    AND ROUND(COALESCE(b.gross_sales,0),2) <> l.sell

  UNION ALL
  SELECT 'trip'::text, t.id, t.trip_name, 'total_gross_sales'::text,
         COALESCE(t.total_gross_sales,0), s.gross,
         ROUND(COALESCE(t.total_gross_sales,0) - s.gross, 2)
  FROM public.trips t
  JOIN (SELECT trip_id, ROUND(SUM(COALESCE(gross_sales,0)),2) gross FROM public.bookings WHERE trip_id IS NOT NULL GROUP BY trip_id) s
    ON s.trip_id = t.id
  WHERE ROUND(COALESCE(t.total_gross_sales,0),2) <> s.gross

  UNION ALL
  SELECT 'trip'::text, t.id, t.trip_name, 'total_paid'::text,
         COALESCE(t.total_paid,0), p.paid,
         ROUND(COALESCE(t.total_paid,0) - p.paid, 2)
  FROM public.trips t
  JOIN (
    SELECT trip_id, ROUND(SUM(public.invoice_cash_amount(tp)), 2) paid
    FROM public.trip_payments tp
    WHERE trip_id IS NOT NULL
    GROUP BY trip_id
  ) p ON p.trip_id = t.id
  WHERE ROUND(COALESCE(t.total_paid,0),2) <> p.paid;
$fn$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.trips LOOP
    PERFORM public.recalc_trip_payment_rollup(r.id);
  END LOOP;
END $$;
