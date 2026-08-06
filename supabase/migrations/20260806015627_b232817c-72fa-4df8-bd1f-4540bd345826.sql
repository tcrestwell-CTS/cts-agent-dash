ALTER TABLE public.agent_notifications ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
UPDATE public.agent_notifications n SET client_id = c.id
FROM public.clients c
WHERE n.client_id IS NULL AND n.type = 'client_message' AND n.title = 'New Message from ' || c.name AND c.user_id = n.user_id;