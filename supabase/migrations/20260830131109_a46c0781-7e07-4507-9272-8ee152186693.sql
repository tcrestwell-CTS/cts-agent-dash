ALTER TABLE public.agent_messages REPLICA IDENTITY FULL;
ALTER TABLE public.agent_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.portal_messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;