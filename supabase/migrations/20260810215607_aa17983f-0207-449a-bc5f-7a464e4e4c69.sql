CREATE TABLE IF NOT EXISTS public.line_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id text NOT NULL UNIQUE,
  display_name text,
  picture_url text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  assigned_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_conversations TO authenticated;
GRANT ALL ON public.line_conversations TO service_role;

CREATE INDEX IF NOT EXISTS idx_line_conversations_client_id ON public.line_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_line_conversations_agent_id ON public.line_conversations(assigned_agent_id);

CREATE TABLE IF NOT EXISTS public.line_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.line_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL DEFAULT 'text',
  text text,
  raw_line_message_id text,
  sent_by_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_messages TO authenticated;
GRANT ALL ON public.line_messages TO service_role;

CREATE INDEX IF NOT EXISTS idx_line_messages_conversation_id ON public.line_messages(conversation_id, created_at);

ALTER TABLE public.line_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_view_own_line_conversations
ON public.line_conversations
FOR SELECT
TO authenticated
USING (
  assigned_agent_id = auth.uid()
  OR assigned_agent_id IS NULL
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'office_admin')
);

CREATE POLICY agent_update_own_line_conversations
ON public.line_conversations
FOR UPDATE
TO authenticated
USING (
  assigned_agent_id = auth.uid()
  OR assigned_agent_id IS NULL
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'office_admin')
);

CREATE POLICY agent_view_line_messages
ON public.line_messages
FOR SELECT
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM public.line_conversations
    WHERE assigned_agent_id = auth.uid()
       OR assigned_agent_id IS NULL
       OR has_role(auth.uid(), 'admin')
       OR has_role(auth.uid(), 'office_admin')
  )
);

CREATE POLICY agent_insert_line_messages
ON public.line_messages
FOR INSERT
TO authenticated
WITH CHECK (
  conversation_id IN (
    SELECT id FROM public.line_conversations
    WHERE assigned_agent_id = auth.uid()
       OR assigned_agent_id IS NULL
       OR has_role(auth.uid(), 'admin')
       OR has_role(auth.uid(), 'office_admin')
  )
);