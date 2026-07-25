DROP POLICY IF EXISTS "Managers can read team messages" ON public.agent_messages;
CREATE POLICY "Authenticated users can read team messages" ON public.agent_messages
  FOR SELECT USING (channel = 'team' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can send DMs" ON public.agent_messages;
CREATE POLICY "Users can send messages" ON public.agent_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
      channel = 'dm' OR channel = 'team'
    )
  );