
DO $$
BEGIN
  BEGIN
    PERFORM vault.create_secret('39a46c46e847bfc1e8396126072e9095fd7df8dd1d255e7fd0f7c012b3ed2c8c', 'PUSH_INTERNAL_SECRET', 'Shared secret for send-push-notification');
  EXCEPTION WHEN unique_violation THEN
    PERFORM vault.update_secret((SELECT id FROM vault.secrets WHERE name = 'PUSH_INTERNAL_SECRET'), '39a46c46e847bfc1e8396126072e9095fd7df8dd1d255e7fd0f7c012b3ed2c8c');
  END;
END $$;

CREATE OR REPLACE FUNCTION public.notify_client_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _secret text;
BEGIN
  IF NEW.sender_type = 'agent' THEN
    SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'PUSH_INTERNAL_SECRET' LIMIT 1;

    PERFORM net.http_post(
      url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', coalesce(_secret, '')
      ),
      body := jsonb_build_object(
        'client_id', NEW.client_id,
        'type', 'advisor_message',
        'title', 'New message from your advisor',
        'body', left(NEW.message, 120)
      ),
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_client_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _secret text;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'PUSH_INTERNAL_SECRET' LIMIT 1;

    PERFORM net.http_post(
      url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', coalesce(_secret, '')
      ),
      body := jsonb_build_object(
        'client_id', NEW.client_id,
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
$$;

CREATE OR REPLACE FUNCTION public.notify_client_document_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _secret text;
BEGIN
  SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'PUSH_INTERNAL_SECRET' LIMIT 1;

  PERFORM net.http_post(
    url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', coalesce(_secret, '')
    ),
    body := jsonb_build_object(
      'client_id', NEW.client_id,
      'type', 'document_uploaded',
      'title', 'Document received',
      'body', 'We received your document. Your advisor will review it shortly.',
      'trip_id', NEW.trip_id
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;
