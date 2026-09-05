CREATE OR REPLACE FUNCTION public.notify_agent_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agent_id uuid;
  _client_name text;
BEGIN
  IF NEW.sender_type = 'client' THEN
    SELECT c.user_id, COALESCE(c.name, 'A client') INTO _agent_id, _client_name
    FROM public.clients c WHERE c.id = NEW.client_id;

    IF _agent_id IS NOT NULL THEN
      INSERT INTO public.agent_notifications (user_id, type, title, message, client_id)
      VALUES (_agent_id, 'client_message', 'New message from ' || _client_name, left(NEW.message, 200), NEW.client_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agent_client_message ON public.portal_messages;
CREATE TRIGGER trg_notify_agent_client_message
AFTER INSERT ON public.portal_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_agent_client_message();