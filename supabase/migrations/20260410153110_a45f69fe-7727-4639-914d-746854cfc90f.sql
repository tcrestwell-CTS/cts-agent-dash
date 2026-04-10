
-- Create QBO supplier-to-vendor mapping table
CREATE TABLE public.qbo_supplier_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  qbo_vendor_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, supplier_id)
);

ALTER TABLE public.qbo_supplier_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own supplier mappings"
  ON public.qbo_supplier_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own supplier mappings"
  ON public.qbo_supplier_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supplier mappings"
  ON public.qbo_supplier_mappings FOR DELETE
  USING (auth.uid() = user_id);

-- Fix the trigger function to send 'supplier_paid' (matching the switch case in qbo-sync-trigger)
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
    SELECT trip_name INTO _trip_name FROM public.trips WHERE id = NEW.trip_id LIMIT 1;
    SELECT name INTO _supplier_name FROM public.suppliers WHERE id = NEW.supplier_id LIMIT 1;

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
        'trigger_type', 'supplier_paid',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
