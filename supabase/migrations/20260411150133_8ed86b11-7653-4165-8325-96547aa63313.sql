CREATE OR REPLACE FUNCTION public.auto_generate_invoice_on_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_number text;
  v_client_name text;
  v_trip_name text;
  v_client_id uuid;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    -- Get client_id from the trip
    IF NEW.trip_id IS NOT NULL THEN
      SELECT client_id, trip_name INTO v_client_id, v_trip_name FROM public.trips WHERE id = NEW.trip_id;
    END IF;

    -- Skip if no client linked
    IF v_client_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Check if invoice already exists for this booking's trip
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices 
      WHERE trip_id = NEW.trip_id 
        AND client_id = v_client_id 
        AND user_id = NEW.user_id
    ) THEN
      v_invoice_number := public.get_next_invoice_number(NEW.user_id);
      SELECT name INTO v_client_name FROM public.clients WHERE id = v_client_id;
      
      INSERT INTO public.invoices (
        user_id, invoice_number, client_id, client_name,
        trip_id, trip_name, total_amount, amount_remaining, status
      ) VALUES (
        NEW.user_id, v_invoice_number, v_client_id, v_client_name,
        NEW.trip_id, v_trip_name, NEW.gross_sales, NEW.gross_sales, 'sent'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;