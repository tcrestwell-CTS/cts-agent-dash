CREATE OR REPLACE FUNCTION public.notify_first_proposal_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF OLD.proposal_viewed_at IS NULL
     AND NEW.proposal_viewed_at IS NOT NULL
     AND OLD.proposal_status IN ('sent', 'viewed')
     AND OLD.proposal_sent_at IS NOT NULL THEN
    INSERT INTO public.agent_notifications (user_id, type, title, message)
    SELECT recipient.user_id, 'proposal_viewed', 'Client viewed your proposal',
      concat_ws(' ', NULLIF(btrim(NEW.first_name), ''), NULLIF(btrim(NEW.last_name), ''))
      || CASE WHEN NULLIF(btrim(NEW.destination), '') IS NOT NULL
           THEN ' viewed the proposal for ' || NEW.destination || '.'
           ELSE ' viewed their travel proposal.' END
    FROM (
      SELECT NEW.assigned_agent_id AS user_id WHERE NEW.assigned_agent_id IS NOT NULL
      UNION
      SELECT user_id FROM public.user_roles
      WHERE NEW.assigned_agent_id IS NULL AND role IN ('admin', 'office_admin')
    ) AS recipient;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.notify_first_proposal_view() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_first_proposal_view() TO service_role;
CREATE TRIGGER on_first_proposal_view
AFTER UPDATE OF proposal_viewed_at ON public.quote_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_first_proposal_view();