CREATE OR REPLACE FUNCTION public.notify_client_payment_received()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _secret text;
  _client_id uuid;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT client_id INTO _client_id FROM public.trips WHERE id = NEW.trip_id;
    IF _client_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'PUSH_INTERNAL_SECRET' LIMIT 1;

    PERFORM net.http_post(
      url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', coalesce(_secret, '')
      ),
      body := jsonb_build_object(
        'client_id', _client_id,
        'type', 'payment_received',
        'title', 'Payment received',
        'body', 'We received your payment of $' || ROUND(NEW.amount, 2)::text || '. Thank you!',
        'trip_id', NEW.trip_id
      ),
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END;
$function$;