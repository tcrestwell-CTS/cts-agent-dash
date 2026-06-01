-- Iris inbox agent: watched mailboxes + processed message dedupe
CREATE TABLE public.inbox_watched_mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'gmail',
  email_address text,
  connection_id text,
  last_history_id text,
  last_synced_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  paused_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, email_address)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_watched_mailboxes TO authenticated;
GRANT ALL ON public.inbox_watched_mailboxes TO service_role;

ALTER TABLE public.inbox_watched_mailboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own watched mailboxes"
ON public.inbox_watched_mailboxes
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role))
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_inbox_watched_mailboxes_updated_at
BEFORE UPDATE ON public.inbox_watched_mailboxes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.inbox_processed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'gmail',
  provider_message_id text NOT NULL,
  thread_id text,
  from_email text,
  from_name text,
  subject text,
  received_at timestamptz,
  classification text,
  linked_lead_id uuid,
  linked_trip_id uuid,
  linked_booking_id uuid,
  proposed_action_id uuid REFERENCES public.ai_proposed_actions(id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  error_message text,
  UNIQUE (user_id, provider, provider_message_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_processed_messages TO authenticated;
GRANT ALL ON public.inbox_processed_messages TO service_role;

ALTER TABLE public.inbox_processed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own processed messages"
ON public.inbox_processed_messages
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Service role manages processed messages"
ON public.inbox_processed_messages
FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_inbox_processed_user_thread ON public.inbox_processed_messages(user_id, thread_id);
CREATE INDEX idx_inbox_processed_classification ON public.inbox_processed_messages(classification);
CREATE INDEX idx_inbox_watched_active ON public.inbox_watched_mailboxes(is_active) WHERE is_active = true;