CREATE OR REPLACE FUNCTION public.notify_terrance_proposal()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
DECLARE
  _service_key text;
BEGIN
  IF NEW.ai_stage IN ('Qualified', 'Quote Needed', 'Call Needed')
     AND (OLD.ai_stage IS DISTINCT FROM NEW.ai_stage)
     AND (NEW.proposal_status IS NULL OR NEW.proposal_status = '') THEN

    SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;

    PERFORM net.http_post(
      url     := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/generate-proposal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body    := jsonb_build_object('lead_id', NEW.id),
      timeout_milliseconds := 30000
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_terrance_proposal
  AFTER UPDATE ON public.quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_terrance_proposal();