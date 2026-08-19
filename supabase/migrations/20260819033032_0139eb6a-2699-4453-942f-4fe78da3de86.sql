CREATE OR REPLACE FUNCTION public.notify_agent_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT COALESCE(full_name, 'A teammate') INTO sender_name
  FROM public.profiles WHERE user_id = NEW.sender_id;
  IF sender_name IS NULL THEN sender_name := 'A teammate'; END IF;

  IF NEW.channel = 'dm' AND NEW.recipient_id IS NOT NULL THEN
    INSERT INTO public.agent_notifications (user_id, type, title, message)
    VALUES (NEW.recipient_id, 'agent_message', 'New message from ' || sender_name, left(NEW.message, 200));
  ELSIF NEW.channel = 'team' THEN
    INSERT INTO public.agent_notifications (user_id, type, title, message)
    SELECT DISTINCT ur.user_id, 'agent_message', sender_name || ' posted in Team Chat', left(NEW.message, 200)
    FROM public.user_roles ur
    WHERE ur.user_id <> NEW.sender_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agent_chat_message ON public.agent_messages;
CREATE TRIGGER trg_notify_agent_chat_message
AFTER INSERT ON public.agent_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_agent_chat_message();