
-- Add supplier payment tracking fields to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS supplier_paid_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS supplier_paid_date date,
  ADD COLUMN IF NOT EXISTS supplier_paid_method text,
  ADD COLUMN IF NOT EXISTS supplier_paid_reference text,
  ADD COLUMN IF NOT EXISTS supplier_paid_amount numeric DEFAULT 0;

-- Add QBO trigger for client payment acknowledgment on trip_payments
CREATE OR REPLACE FUNCTION public.trigger_qbo_client_payment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _service_key text;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    -- Create agent notification
    INSERT INTO public.agent_notifications (user_id, type, title, message, trip_id, trip_payment_id)
    VALUES (
      NEW.user_id,
      'payment_received',
      'Payment Received',
      'A payment of $' || ROUND(NEW.amount, 2)::text || ' has been marked as received.',
      NEW.trip_id,
      NEW.id
    );

    -- Trigger QBO sync
    SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;

    PERFORM net.http_post(
      url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/qbo-sync-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := jsonb_build_object(
        'trigger_type', 'client_payment_received',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_trip_payment_paid ON public.trip_payments;
CREATE TRIGGER on_trip_payment_paid
  AFTER UPDATE ON public.trip_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_qbo_client_payment();

-- Add QBO trigger for supplier payment acknowledgment on bookings
CREATE OR REPLACE FUNCTION public.trigger_qbo_supplier_payment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _service_key text;
  _trip_name text;
  _supplier_name text;
BEGIN
  IF NEW.supplier_paid_status = 'paid' AND (OLD.supplier_paid_status IS DISTINCT FROM 'paid') THEN
    -- Get trip and supplier names for notification
    SELECT trip_name INTO _trip_name FROM public.trips WHERE id = NEW.trip_id LIMIT 1;
    SELECT name INTO _supplier_name FROM public.suppliers WHERE id = NEW.supplier_id LIMIT 1;

    -- Create agent notification
    INSERT INTO public.agent_notifications (user_id, type, title, message, trip_id)
    VALUES (
      NEW.user_id,
      'supplier_paid',
      'Supplier Payment Confirmed',
      'Payment of $' || ROUND(COALESCE(NEW.supplier_paid_amount, NEW.supplier_payout, 0), 2)::text ||
        ' to ' || COALESCE(_supplier_name, 'supplier') ||
        ' for ' || COALESCE(_trip_name, 'booking') || ' confirmed.',
      NEW.trip_id
    );

    -- Trigger QBO sync
    SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;

    PERFORM net.http_post(
      url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/qbo-sync-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := jsonb_build_object(
        'trigger_type', 'supplier_payment_confirmed',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_supplier_paid ON public.bookings;
CREATE TRIGGER on_booking_supplier_paid
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_qbo_supplier_payment();
