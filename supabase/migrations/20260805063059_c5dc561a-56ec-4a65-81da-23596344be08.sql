
CREATE TABLE IF NOT EXISTS public.client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_client_notifications_client_id ON public.client_notifications(client_id);
GRANT ALL ON public.client_notifications TO service_role;
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.client_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_push_tokens_client_id ON public.client_push_tokens(client_id);
GRANT ALL ON public.client_push_tokens TO service_role;
ALTER TABLE public.client_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.notify_client_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _service_key text;
BEGIN
  IF NEW.sender_type = 'agent' THEN
    SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;

    PERFORM net.http_post(
      url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
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
$function$;

DROP TRIGGER IF EXISTS trg_notify_client_new_message ON public.portal_messages;
CREATE TRIGGER trg_notify_client_new_message
AFTER INSERT ON public.portal_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_client_new_message();

CREATE OR REPLACE FUNCTION public.notify_client_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _service_key text;
  _client_id uuid;
  _trip_name text;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT client_id, trip_name INTO _client_id, _trip_name
    FROM public.trips WHERE id = NEW.trip_id;

    IF _client_id IS NOT NULL THEN
      SELECT decrypted_secret INTO _service_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
      LIMIT 1;

      PERFORM net.http_post(
        url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        ),
        body := jsonb_build_object(
          'client_id', _client_id,
          'type', 'payment_received',
          'title', 'Payment received',
          'body', 'Your payment of $' || NEW.amount || ' for ' || COALESCE(_trip_name, 'your trip') || ' was received.',
          'trip_id', NEW.trip_id
        ),
        timeout_milliseconds := 5000
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_client_payment_received ON public.trip_payments;
CREATE TRIGGER trg_notify_client_payment_received
AFTER UPDATE ON public.trip_payments
FOR EACH ROW
EXECUTE FUNCTION public.notify_client_payment_received();

CREATE OR REPLACE FUNCTION public.notify_client_document_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _service_key text;
  _client_id uuid;
BEGIN
  IF NEW.uploaded_by IS NOT NULL THEN
    SELECT client_id INTO _client_id FROM public.trips WHERE id = NEW.trip_id;

    IF _client_id IS NOT NULL THEN
      SELECT decrypted_secret INTO _service_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
      LIMIT 1;

      PERFORM net.http_post(
        url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        ),
        body := jsonb_build_object(
          'client_id', _client_id,
          'type', 'document_uploaded',
          'title', 'New document from your advisor',
          'body', COALESCE(NEW.label, NEW.file_name),
          'trip_id', NEW.trip_id
        ),
        timeout_milliseconds := 5000
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_client_document_uploaded ON public.client_document_uploads;
CREATE TRIGGER trg_notify_client_document_uploaded
AFTER INSERT ON public.client_document_uploads
FOR EACH ROW
EXECUTE FUNCTION public.notify_client_document_uploaded();
